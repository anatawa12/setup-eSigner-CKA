# Setup eSigner CKA

A GitHub Action to set up [eSigner CKA]

[eSigner CKA]: https://www.ssl.com/downloads/#cka

## How to use

```yaml
steps:
  - uses: anatawa12/setup-eSigner-CKA@v1
    with:
      mode: sandbox # or product
      username: ${{ secrets.E_SIGNER_USERNAME }}
      password: ${{ secrets.E_SIGNER_PASSWORD }}
      totp-secret: ${{ secrets.E_SIGNER_TOTP_SECRET }}

  - name: Sign exe
    shell: powershell
    env:
      THUMBPRINT: ${{ secrets.CERT_THUMBPRINT }}
    run: |
      $THUMBPRINT = $env:THUMBPRINT
      & 'C:/Program Files (x86)/Windows Kits/10/bin/10.0.22621.0/x86/signtool.exe' `
        sign /fd SHA256 /sha1 "$THUMBPRINT" /d "HelloWorld.exe" /tr "http://ts.ssl.com" /td sha256 "path/to/your.exe"
```
