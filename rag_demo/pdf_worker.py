"""Private, credential-free PDF extraction process. Not a network service.

The parent enforces wall time and bounds input. OS limits bound parser memory
before pypdf is imported. Failure to install limits rejects the PDF.
"""
from contextlib import redirect_stdout
from io import BytesIO
import json
import logging
import math
import os
from pathlib import Path
import sys


def resource_limits(memory_bytes, seconds):
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes

        class BasicLimits(ctypes.Structure):
            _fields_ = [("process_time", ctypes.c_int64), ("job_time", ctypes.c_int64),
                        ("flags", wintypes.DWORD), ("min_working", ctypes.c_size_t),
                        ("max_working", ctypes.c_size_t), ("active", wintypes.DWORD),
                        ("affinity", ctypes.c_size_t), ("priority", wintypes.DWORD),
                        ("scheduling", wintypes.DWORD)]

        class IoCounters(ctypes.Structure):
            _fields_ = [(name, ctypes.c_uint64) for name in
                        ("read_ops", "write_ops", "other_ops", "read_bytes", "write_bytes", "other_bytes")]

        class ExtendedLimits(ctypes.Structure):
            _fields_ = [("basic", BasicLimits), ("io", IoCounters),
                        ("process_memory", ctypes.c_size_t), ("job_memory", ctypes.c_size_t),
                        ("peak_process", ctypes.c_size_t), ("peak_job", ctypes.c_size_t)]

        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
        kernel.CreateJobObjectW.restype = wintypes.HANDLE
        kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
        kernel.SetInformationJobObject.restype = wintypes.BOOL
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
        kernel.AssignProcessToJobObject.restype = wintypes.BOOL
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel.CloseHandle.restype = wintypes.BOOL
        job = kernel.CreateJobObjectW(None, None)
        if not job:
            raise RuntimeError("Parser limits unavailable")
        limits = ExtendedLimits()
        # PROCESS_MEMORY | ACTIVE_PROCESS | PROCESS_TIME. One process only.
        limits.basic.flags = 0x100 | 0x8 | 0x2
        limits.basic.active = 1
        limits.basic.process_time = math.ceil(seconds) * 10_000_000
        limits.process_memory = memory_bytes
        if (not kernel.SetInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits))
                or not kernel.AssignProcessToJobObject(job, kernel.GetCurrentProcess())):
            kernel.CloseHandle(job)
            raise RuntimeError("Parser limits unavailable")
        # Retain the handle for the entire extraction; the OS reclaims it on exit.
        return job
    if sys.platform.startswith("linux"):
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
        cpu = math.ceil(seconds)
        resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        return None
    raise RuntimeError("Parser resource limits are unsupported on this platform")


def guard(event, arguments):
    if event.startswith("socket.") or event in {"subprocess.Popen", "os.system", "os.posix_spawn"}:
        raise PermissionError("Parser external I/O is disabled")
    if event == "open" and isinstance(arguments[0], (str, bytes)):
        if os.path.basename(os.fsdecode(arguments[0])).lower().startswith(".env"):
            raise PermissionError("Parser environment-file reads are disabled")


def parse(content, limits):
    from pypdf import PdfReader, apply_configuration
    size = limits["max_pdf_stream_bytes"]
    # Enforce decoder limits while allocating, before get_data() returns.
    with apply_configuration(
        maximum_declared_stream_length=size, array_based_stream_maximum_output_length=size,
        zlib_maximum_output_length=size, lzw_maximum_output_length=size,
        run_length_maximum_output_length=size, brotli_maximum_output_length=size,
        jbig2_maximum_output_length=size, image_maximum_buffer_size=size,
        zlib_maximum_recovery_input_length=0, stream_filters_maximum_length=4,
        stream_decoding_work_maximum_length=limits["max_pdf_total_stream_bytes"],
        page_tree_maximum_entries=limits["max_pdf_pages"] + 1,
        page_tree_maximum_depth=20, xform_maximum_invocations_per_extraction=100,
        jbig2dec_binary=None,
    ):
        reader = PdfReader(BytesIO(content), strict=True)
        if reader.is_encrypted or not 1 <= len(reader.pages) <= limits["max_pdf_pages"]:
            raise ValueError("Unsupported page count or encryption")
        pages, chars, decoded = [], 0, 0
        for page in reader.pages:
            stream = page.get_contents()
            decoded += len(stream.get_data()) if stream is not None else 0
            if decoded > limits["max_pdf_total_stream_bytes"]:
                raise ValueError("Decoded content exceeds limit")
            text = page.extract_text() or ""
            chars += len(text)
            if chars > limits["max_chars"]:
                raise ValueError("Extracted text exceeds limit")
            pages.append(text)
        if not any(page.strip() for page in pages):
            raise ValueError("No usable text")
        return pages


def main():
    try:
        limits = json.loads(sys.argv[2])
        job = resource_limits(limits["pdf_memory_bytes"], limits["pdf_timeout_seconds"])
        sys.path.insert(0, str(Path(sys.argv[1]).resolve()))
        sys.addaudithook(guard)
        logging.disable(logging.CRITICAL)
        content = sys.stdin.buffer.read(limits["max_bytes"] + 1)
        if not content.startswith(b"%PDF-") or len(content) > limits["max_bytes"]:
            raise ValueError("Invalid input")
        with open(os.devnull, "w") as sink, redirect_stdout(sink):
            pages = parse(content, limits)
        sys.stdout.buffer.write(json.dumps({"pages": pages}).encode("utf-8"))
        return 0
    except Exception:
        # Neither document text, paths, credentials nor parser exception details.
        return 1


if __name__ == "__main__":
    sys.exit(main())
