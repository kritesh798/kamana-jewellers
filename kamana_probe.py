import json, urllib.request, urllib.error, http.cookiejar

BASE = "http://localhost:3000"

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def req(method, path, body=None, cookie=None, origin=None):
    url = BASE + path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if cookie:
        headers["Cookie"] = cookie
    if origin:
        headers["Origin"] = origin
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        resp = urllib.request.urlopen(r)
        return resp.status, resp.read().decode()[:300]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]

# Login via opener to capture cookie
data = json.dumps({"email": "admin@test.local", "password": "a-long-test-password-123"}).encode()
opener.open(urllib.request.Request(BASE + "/api/login", data=data, method="POST",
                                   headers={"Content-Type": "application/json"}))
cookie = "; ".join(f"{c.name}={c.value}" for c in cj)
print("cookie:", cookie)

def a(method, path, body=None, origin=None):
    return req(method, path, body, cookie, origin)

print("\n=== SQL injection in product name ===")
st, body = a("POST", "/api/admin/products", {"name": "'); DROP TABLE products; --", "category": "bracelets", "image": "assets/photos/products/bracelet-01.jpg"})
print(f"  status={st} {body}")

print("\n=== Stored XSS product name ===")
st, body = a("POST", "/api/admin/products", {"name": "<img src=x onerror=alert(1)>", "category": "bracelets", "image": "assets/photos/products/bracelet-01.jpg"})
print(f"  status={st} {body}")

st, body = req("GET", "/api/products")
d = json.loads(body)
xss = [i for i in d["items"] if "<img" in i["name"]]
print(f"  products with '<img' in name: {len(xss)}")
for i in xss[:3]:
    print(f"    id={i['id']} name={i['name']!r}")

print("\n=== Image path traversal ===")
st, body = a("POST", "/api/admin/products", {"name": "x", "category": "bracelets", "image": "../../server/db.js"})
print(f"  status={st} {body}")

print("\n=== Image path data URI ===")
st, body = a("POST", "/api/admin/products", {"name": "x", "category": "bracelets", "image": "data:image/png;base64,AAAA"})
print(f"  status={st} {body}")

print("\n=== SQL injection in requests (unauth) ===")
st, body = req("POST", "/api/requests", {"name": "x", "phone": "1", "type": "Repair", "description": "Robert'); DROP TABLE users; --"})
print(f"  status={st} {body}")

print("\n=== Extra fields / mass assignment ===")
st, body = a("POST", "/api/admin/products", {"name": "x", "category": "bracelets", "role": "admin", "id": 1, "image": "assets/photos/products/bracelet-01.jpg"})
print(f"  status={st} {body}")

print("\n=== IDOR: nonexistent request update ===")
st, body = a("PUT", "/api/admin/requests/999999", {"status": "done"})
print(f"  status={st} {body}")

print("\n=== Negative rate ===")
st, body = a("PUT", "/api/admin/rates", {"hallmark_gold": -9999999999, "tejabi_gold": "", "silver": "", "updated_bs": ""})
print(f"  status={st} {body}")

print("\n=== Category ID path traversal ===")
st, body = a("PUT", "/api/admin/categories/../../../etc/passwd", {"label": "x"})
print(f"  status={st} {body}")

print("\n=== Cross-origin request ===")
st, body = req("POST", "/api/requests", {"name": "x", "phone": "1", "type": "Repair", "description": "x"}, origin="https://evil.example")
print(f"  cross-origin request: {st} {body}")

print("\n=== DELETE nonexistent product ===")
st, body = a("DELETE", "/api/admin/products/999999")
print(f"  status={st} {body}")

st, body = req("GET", "/api/products")
d = json.loads(body)
uploads = [i["image"] for i in d["items"] if i.get("image", "").startswith("assets/photos/uploads/")]
print(f"\n=== uploaded products visible: {len(uploads)}")

st, body = req("GET", "/assets/../server/server.js")
print(f"\n=== static traversal /assets/../server/server.js: {st}")