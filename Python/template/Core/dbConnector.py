from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class DbConnector:
  OPTIONS = { 'driver': 'ODBC DRIVER 17 FOR SQL SERVER',}

  ENGINE = {
    'SQLSERVER': 'sql_server.pyodbc',
    'MYSQL': 'django.db.backends.mysql',
    'SQLITE': 'django.db.backends.sqlite3',
    'POSTGRESQL': 'django.db.backends.postgresql_psycopg2',
   }

  SQLITE = {
    'ENGINE': 'django.db.backends.sqlite3',
    'NAME': BASE_DIR / 'NEW_DB_NAME',
   }

  CONNECTOR = {
    "ENGINE": ENGINE['POSTGRESQL'],
    "HOST": "NEW_DB_HOST",
    "USER": "NEW_DB_USER",
    "NAME": "NEW_DB_NAME",
    "PASSWORD": "NEW_DB_PASSWORD",
    "PORT": 'NEW_DB_PORT',
    }

  @classmethod
  def get(cls, dbtype=None):
    if dbtype == 'SQLITE' or not dbtype:
      cls.CONNECTOR.clear(); cls.CONNECTOR.update(cls.SQLITE)
      return cls.CONNECTOR
    elif dbtype == 'SQLSERVER': cls.CONNECTOR.update({'OPTIONS': cls.OPTIONS})
    cls.CONNECTOR.update({'ENGINE': cls.ENGINE[dbtype]})
    return cls.CONNECTOR
