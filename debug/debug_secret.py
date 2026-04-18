
#!/usr/bin/env python3
import os
os.makedirs("logs", exist_ok=True)

# Print SECRET_KEY in backend.auth
from backend import auth
print(f"In backend.auth: SECRET_KEY = {repr(auth.SECRET_KEY)}")
print(f"          id(SECRET_KEY) = {id(auth.SECRET_KEY)}")
print(f"            len(SECRET_KEY) = {len(auth.SECRET_KEY)}")

from core.config import settings
print(f"\nFrom core.config.settings: jwt_secret_key = {repr(settings.jwt_secret_key)}")
print(f"          id(jwt_secret_key) = {id(settings.jwt_secret_key)}")
print(f"            len(jwt_secret_key) = {len(settings.jwt_secret_key)}")

print(f"\nAre they the same object? {auth.SECRET_KEY is settings.jwt_secret_key}")
print(f"Are they equal in value? {auth.SECRET_KEY == settings.jwt_secret_key}")
