# XXI Explorer

This is Twenty One Capital's explorer at mempool.twentyonecapital.com. It is
derived from the open-source code for mempool.space (The Mempool Open Source
Project®) and licensed under the GNU Affero General Public License v3 (see
`LICENSE`). Twenty One Capital, Inc. modified it from November 2026; the table
below lists the changes, and the git history dates each one. It is not affiliated
with or endorsed by The Mempool Open Source Project. mempool.space® is a
registered trademark of Mempool Holdings S.A. de C.V.

Branch `twentyone` is based on upstream tag `v3.3.2`. The changes are kept
small so that upstream releases merge cleanly.

## What this fork changes

| Area | Change |
|---|---|
| Theme | `frontend/src/theme-twentyone.scss`: Twenty One colors and type instead of mempool's palette |
| Branding | `frontend/custom-twentyone-config.json`, `frontend/src/index.mempool.twentyone.html`, `frontend/src/resources/twentyone/`: wordmark, favicon, fonts, preview image. No mempool logos. Analytics off (`site_id: null`). |
| Dashboard | Disclosed-address balance, chart and transactions, latest company news (official releases), fees, and blocks |
| News widget | `frontend/src/app/components/news-widget/`: the `news` dashboard widget, fed by the self-hosted helper at `/api/v1/services/news`; headlines link to twentyonecapital.com/investors#news |
| Footer | Twenty One legal links and X account, AGPL source link, trademark notice |
| Backend Docker config | `WALLETS_*` settings so the open-source wallet feature can be switched on (off by default) |
| Docker build | `CUSTOMIZATION` build argument and `docker/build-twentyone.sh` |
| Mempool branding removed | mempool's logos, favicons, preview cards, promo video and screenshots are deleted, and the logo drawings are removed from `svg-images`, as mempool's trademark policy requires of modified versions. `sync-assets.js` no longer downloads the promo video |
| About page | `components/about/`: replaced with Twenty One's page: what the explorer is, the AGPL notices (copyright, no warranty, license, third-party licenses), the source link and the trademark notices |
| Redirects | mempool.space's own terms, privacy and trademark pages, the FAQ and the API docs (written as mempool.space) redirect to `/about`; their footer and nav links are hidden |
| Link previews | `opengraph.service.ts`: every page uses Twenty One's preview image (mempool's per-page cards and render service aren't part of this build) |
| Dependency patches | Security bumps ahead of upstream (2026-11-19): backend `ws`, `axios`, `mysql2`, `bitcoinjs-lib`, `express`; frontend `@angular/*` to the latest 20.3.x and the `tar` override. Keep these when merging upstream, unless upstream has newer versions |

Runtime settings are in the private `mempool-infra` repository. They point the
backend at a self-hosted Fulcrum Electrum server and point the `services` API at a small
self-hosted helper, so the explorer sends nothing to mempool.space.

## Licensing and notices

- **AGPL source offer.** The footer and the About page link to this repository.
  The running site must always be built from a commit that is pushed here, so the
  linked source matches what runs. The About page shows the running commit.
- **Modification notice.** This file, the README header and the About page state
  that Twenty One Capital, Inc. modified the software, and when.
- **Trademarks.** mempool's logos are removed. Its word marks are used only to
  describe where the software comes from, with its required trademark attribution
  in the footer and on the About page. The Twenty One Capital name and logos
  (`frontend/src/resources/twentyone/`, `frontend/src/resources/xxi/`) are
  trademarks of Twenty One Capital, Inc., not licensed under the AGPL.
- **Fonts.** Inter, IBM Plex Mono and Newsreader are under the SIL Open Font
  License 1.1; the license texts are next to the font files.

## Build

```sh
docker/build-twentyone.sh
```
