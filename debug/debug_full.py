
#!/usr/bin/env python3
import os
import datetime
os.makedirs("logs", exist_ok=True)

from jose import JWTError, jwt
from backend.auth import create_access_token, decode_token
from core.config import settings
from datetime import timedelta

print(f"Using SECRET_KEY: {repr(settings.jwt_secret_key)}")
print(f"Length: {len(settings.jwt_secret_key)}")
print(f"Algorithm: HS256")

# Create directly with jwt.encode
expire = datetime.datetime.utcnow() + timedelta(minutes=30)
payload = {"sub": 1, "exp": expire}
encoded = jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")
print(f"\nDirect jwt.encode: {encoded[:80]}...")

# Decode directly
try:
    decoded = jwt.decode(encoded, settings.jwt_secret_key, algorithms=["HS256"])
    print(f"Direct jwt.decode SUCCESS: {decoded}")
except JWTError as e:
    print(f"Direct jwt.decode FAILED: {e}")

# Now use our functions
print(f"\n--- Using backend.auth functions ---")
token = create_access_token(data={"sub": 1})
print(f"create_access_token: {token[:80]}...")

result = decode_token(token)
print(f"decode_token result: {result}")

if result is None:
    print("\nDEBUG: Let's try to decode it manually...")
    try:
        decoded2 = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
        print(f"Manual decode SUCCESS: {decoded2}")
    except JWTError as e2:
        print(f"Manual decode FAILED: {e2}")
