# Production Policy Registration TLS

Production policy registration must authenticate the Supabase PostgreSQL server,
not merely encrypt the connection.

1. In the Supabase project dashboard, open **Connect** or **Database Settings**
   and download the server root certificate for the intended Production project.
2. Keep the certificate outside Git on the authorized workstation.
3. Add both parameters to the private PostgreSQL URL used for registration:

```text
sslmode=verify-full&sslrootcert=<absolute-path-to-downloaded-certificate>
```

For example, set the complete URL only in the current private PowerShell window:

```powershell
$env:SUPABASE_DB_URL = "postgresql://<user>:<password>@<host>:5432/postgres?sslmode=verify-full&sslrootcert=C%3A%5Cprivate%5Cprod-supabase.cer"
```

Percent-encode reserved URL characters in the certificate path. Never commit the
URL, password, or certificate. The registrar rejects Production URLs with
`sslmode=require`, `verify-ca`, downgradeable modes, multiple TLS modes, or no
trusted root certificate. It leaves an already-correct `verify-full` URL intact,
so Psycopg keyword arguments cannot silently replace stronger connection
settings.

Registration remains a controlled action. This document does not authorize a
hosted migration, registration run, import, embedding request, or production
data change.
