# Twenty One Capital explorer

This is Twenty One Capital's explorer at mempool.twentyonecapital.com. It is
derived from the open-source code for mempool.space (The Mempool Open Source
Project®) and licensed under the GNU Affero General Public License v3 (see
`LICENSE`). It is not affiliated with or endorsed by The Mempool Open Source
Project. mempool.space® is a registered trademark of Mempool Holdings S.A. de C.V.

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

Runtime settings are in the private `mempool-infra` repository. They point the
backend at a self-hosted Fulcrum Electrum server and point the `services` API at a small
self-hosted helper, so the explorer sends nothing to mempool.space.

## Build

```sh
docker/build-twentyone.sh
```
