# Changelog

All notable changes to the `@ln-church/server` and Monzenmachi Hono Starter Kit will be documented in this file.

## [1.2.0] - 2026-04-13 (Standard Protocols Alignment)

This major update aligns the server layer with the exact standards defined by the `ln-church-agent` v1.5.3 specification, ensuring flawless machine-to-machine compatibility across the open web.

### Added
* **MPP (Machine Payments Protocol) Support**: Added native support for the IETF draft standard `Payment <preimage>` Authorization headers alongside existing L402 macaroons.
* **Standard 402 Headers**: The core engine now automatically issues x402 Foundation standard headers (`PAYMENT-REQUIRED`, `PAYMENT-RESPONSE`) and MPP standard headers (`Payment-Receipt`).
* **Enhanced HATEOAS**: Refactored the `buildHateoasResponse` engine to output strict, standard-compliant HATEOAS guides (`instruction_for_agents.next_request_schema`) that natively parse in the newest agent SDKs.

### Fixed
* **Legacy Compatibility**: Maintained backward compatibility for early agent payloads (e.g., parsing the legacy `PAYMENT <charge>:<preimage>` format).

## [1.1.0] - Initial Stable Release
* Initial release featuring L402 verifiers, Faucet verifiers, and Cloudflare KV Replay Protection.