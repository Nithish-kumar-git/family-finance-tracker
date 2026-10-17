"""Run with the backend's actual environment. Metadata only; never prints a URL.

Does not load local dotenv files, create tables, or query household records.
Example: python security/check_backend_role.py
"""
import json
import os
import sys

from sqlalchemy import create_engine, text


def main():
    url = os.getenv('SUPABASE_DATABASE_URL')
    if not url:
        print('SUPABASE_DATABASE_URL is missing; no connection attempted.')
        return 1
    engine = None
    try:
        engine = create_engine(url, connect_args={'connect_timeout': 10}, hide_parameters=True)
        with engine.connect() as connection:
            connection.execute(text('SET TRANSACTION READ ONLY'))
            role = dict(connection.execute(text('''
                SELECT current_user AS database_role, session_user AS login_role,
                       rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
                FROM pg_roles WHERE rolname = current_user
            ''')).mappings().one())
            tables = [dict(row) for row in connection.execute(text('''
                SELECT c.relname AS table_name,
                       pg_get_userbyid(c.relowner) = current_user AS owns_table,
                       has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
                       has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,
                       has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
                       has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete
                FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE n.nspname='public' AND c.relkind='r'
                ORDER BY c.relname
            ''')).mappings()]
            connection.rollback()
        print(json.dumps({'role': role, 'tables': tables}, indent=2))
        return 0
    except Exception as error:
        print('Metadata check failed (' + type(error).__name__ + '); credentials and exception details withheld.')
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == '__main__':
    sys.exit(main())
