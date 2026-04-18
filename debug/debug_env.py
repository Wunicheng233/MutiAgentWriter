
#!/usr/bin/env python3
from pathlib import Path
from core.config import settings

content = Path('.env').read_text()
lines = content.split('\n')
for line in lines:
    if 'JWT_SECRET_KEY' in line and '=' in line:
        print(f"Raw line: {repr(line)}")
        key, value = line.split('=', 1)
        print(f"Value: {repr(value)}")
        print(f"Value stripped: {repr(value.strip())}")
        print(f"Length: {len(value.strip())}")

print()
print(f"settings.jwt_secret_key from Pydantic: {repr(settings.jwt_secret_key)}")
print(f"Length: {len(settings.jwt_secret_key)}")
