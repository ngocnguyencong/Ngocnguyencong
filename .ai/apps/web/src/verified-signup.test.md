# apps/web/src/verified-signup.test.ts

Pins that invalid or unverified sessions cannot reach the password setter,
while a verified session can set a bounded password; setter failures return a
closed result without exposing internal errors or password material.
