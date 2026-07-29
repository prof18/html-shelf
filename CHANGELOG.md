# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-29

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

[1.0.0]: https://github.com/prof18/html-shelf/releases/tag/1.0.0
