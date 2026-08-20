# Security policy

FocusPath opens URLs in a real browser and should only be run against pages you are authorized to test. Treat generated reports as sensitive: screenshots and URLs may contain private information.

The hosted API accepts only public HTTP(S) destinations, rejects private and reserved IP ranges, checks DNS before navigation and applies the same policy to browser subrequests. These controls reduce SSRF risk but do not replace network-level egress filtering for a high-volume public deployment. See `infra/aws/README.md` for the production hardening path.

Please do not disclose potential vulnerabilities in a public issue. Contact the repository owner privately through their public GitHub contact details and include a minimal reproduction.
