# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.4] - 2026-07-30

### Added

- Copy a page's vault-relative path from the shelf entry menu: long-press on mobile or right-click on desktop, then choose **Copy path**.

## [0.0.3] - 2026-07-30

### Added

- Delete HTML files from the shelf after confirmation: long-press on mobile or right-click on desktop. The removal follows Obsidian's deleted-files preference.
- An Android shelf screenshot alongside the existing desktop and rendered-page examples.

### Fixed

- Wrap long section names, page titles, and paths instead of allowing them to overflow narrow layouts.
- Use the product name “HTML Shelf” consistently in the shelf heading and tab.

### Changed

- Document the Obsidian Sync setting required to sync HTML files between devices.
- Present README screenshots as stacked sections so they embed reliably on small screens and third-party platforms.

## [0.0.2] - 2026-07-29

### Added

- Searchable settings definitions for Obsidian 1.13 and newer, with the existing settings interface retained for Obsidian 1.12.
- Signed build-provenance attestations and generated release notes for future GitHub releases.
- Official Obsidian plugin lint rules in the local and CI quality gate.
- Renovate configuration for scheduled, grouped dependency updates.

### Changed

- Raised the minimum supported Obsidian version from 1.5.0 to 1.12.0.
- Replaced deprecated build tooling and newer-than-declared workspace APIs with supported alternatives.

### Fixed

- Removed runtime-created style elements while preserving theme hints, mobile bottom clearance, and iOS shadow rendering.

## [0.0.1] - 2026-07-29

### Added

- A searchable shelf of `.html` and optional `.htm` files, grouped by vault folder.
- Optional `html-shelf.json` files for curated titles and sections.
- Safe in-app HTML rendering on Obsidian desktop, Android, and iOS.
- Internal page links, in-page anchors, index links back to the shelf, external links, page history, and scroll restoration.
- Live refresh when HTML files or manifests change.
- Live include-folder, exclude-folder, and `.htm` listing settings.
- Theme-aware rendering and workspace-state restoration.

### Security

- HTML sanitization removes scripts, handlers, embedded executable content, unsafe URLs, remote stylesheets, and inline CSS imports before rendering.

[0.0.2]: https://github.com/prof18/html-shelf/compare/0.0.1...0.0.2
[0.0.3]: https://github.com/prof18/html-shelf/compare/0.0.2...0.0.3
[0.0.4]: https://github.com/prof18/html-shelf/compare/0.0.3...0.0.4
[0.0.1]: https://github.com/prof18/html-shelf/releases/tag/0.0.1
