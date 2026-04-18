
#!/usr/bin/env python3
# Test if default secret works
import logging
import os
os.makedirs("logs", exist_ok=True)

from jose import JWTError, jwt

# The token from the screenshot
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlhdCI6MTc0NTQyNjQwMCwiZXhwIjoxNzQ1NTEyODAwfQ.zrwGsz6aYokEPZkB4XAKrKkSOy1hCA17AxpArriJH3w"

# Try default secret
default_secret = "your-secret-key-change-in-production-keep-it-safe"
print(f"Trying default secret: {default_secret}")
try:
    payload = jwt.decode(token, default_secret, algorithms=["HS256"])
    print(f"✅ SUCCESS with DEFAULT secret! Decoded payload: {payload}")
except JWTError as e:
    print(f"❌ FAILED with default secret: {e}")

print()

# Try .env secret
env_secret = "2b4f3a8e1c7d9i0k2p4q6r8s1t3v5x7z9y2b4d6f8h1j3l5n7p9r2t4v6y8a1c3e"
print(f"Trying .env secret: {env_secret}")
try:
    payload = jwt.decode(token, env_secret, algorithms=["HS256"])
    print(f"✅ SUCCESS with ENV secret! Decoded payload: {payload}")
except JWTError as e:
    print(f"❌ FAILED with env secret: {e}")
