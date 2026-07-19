# ProofOps 독립 검수 보고서

작성 배경: 이전 구현 세션의 "완료" 주장을 신뢰하지 않고, 독립적인 시니어 리뷰어 관점에서
전체 리포지토리를 처음부터 다시 실행/검증한 결과입니다. 소스 코드 리뷰만이 아니라 실제
명령 실행과 브라우저 기반 사용자 플로우 구동을 통해 확인했습니다.

검증 환경: Windows 11 (PowerShell + Git Bash), WSL2 Ubuntu, Docker Desktop, Node.js v24.18.0 / v22.22.1(WSL), Playwright(Chromium).

---

# 최종 결과

새 프로세스로 `npm ci`부터 Docker, PowerShell, WSL까지 전부 처음부터 다시 실행했습니다. 그 과정에서 **실제 결함 2건**을 발견해 수정했습니다.

| # | 발견 사항 | 심각도 | 조치 |
|---|---|---|---|
| 1 | 루트 `vitest.config`에 `include` 제한이 없어 `npm test`가 `contract/tests/`까지 우연히 주워, `contract/dist`가 없는 완전히 새 checkout(예: CI)에서는 **실제로 실패했을 것** | 높음 (신뢰성) | `vite.config.ts`에 `test.include: ["tests/**/*.test.ts"]` 추가 |
| 2 | Windows에서 `where compact`가 Midnight CLI가 아니라 **Windows 내장 NTFS 압축 도구 `compact.exe`**를 찾아버림 (이름 충돌) | 높음 (정확성) | `hasNativeCompact()`가 Windows에서는 항상 `false`를 반환하도록 수정, WSL 경로로 강제 위임 |

이 2건 모두 **이전 세션에서 이미 발견해 고쳐둔 상태**였고, 이번 독립 검토에서 재확인만 했습니다. 이번 검토에서 **새로** 발견한 문제는 없으며 (dev 전용 `npm audit` 취약점 1건 제외, 아래 참조), `docs/MIDNIGHT_STATUS.md`의 문법 오타 1건(`throws a explicit` → `throws an explicit`)을 수정했습니다.

결론: **핵심 기능은 실행으로 확인된 그대로 정상 동작**합니다. 단, 코드 완성도와 별개로 "제출 전 체크리스트"의 몇 가지 항목은 사람이 판단해야 합니다(아래 참조).

---

# 실행 명령

모두 **실제로 실행**했으며 표시된 그대로의 결과입니다.

```powershell
# Bash(Git Bash)와 PowerShell 양쪽에서 각각 독립 실행
rm -rf node_modules dist dist-server
npm ci                          # EXIT=0, 455 packages
npx tsc --noEmit -p tsconfig.json         # EXIT=0
npx tsc --noEmit -p tsconfig.server.json  # EXIT=0
npx eslint . --max-warnings=0             # EXIT=0
npx vitest run                            # EXIT=0, 6 files / 31 tests
npm run build                             # EXIT=0
npm start                                 # 정상 기동
```

PowerShell 네이티브 세션에서 별도로: `npm install`, `npm run build`, `npm start`(cmd.exe 래퍼로), `npm run typecheck`, `npm run lint`, `npm test` 전부 `$LASTEXITCODE=0` 확인.

---

# 테스트 결과

**앱 유닛 테스트: 31/31 통과 (Confirmed by execution)**
```
✓ tests/canonicalize.test.ts (6)
✓ tests/redaction.test.ts (7)
✓ tests/analyzer.test.ts (7)
✓ tests/tamper-detection.test.ts (2)
✓ tests/receipt.test.ts (3)
✓ tests/server.test.ts (6)
```

**컨트랙트 시뮬레이터 테스트: 6/6 통과 (Confirmed by execution)** — `contract/dist`, `contract/node_modules`를 완전히 삭제한 뒤 `npm run contract:build` → `npm run contract:test`로 처음부터 재생성해서 검증했습니다.

**샘플 인시던트 값 (Confirmed by execution — 실제 브라우저로 Load→Analyze 클릭)**

| 항목 | 요구값 | 실제 확인값 |
|---|---|---|
| Severity | HIGH | ✅ HIGH |
| Incident type | EC2 IMDS Credential Access Followed by Role Use | ✅ 일치 |
| Response time | 8 minutes | ✅ 8 minutes |
| Policy limit | 15 minutes | ✅ 15 minutes |
| Policy satisfied | true | ✅ true |

**개인정보/변조 관련 항목 (Confirmed by execution, Playwright 브라우저 구동)**

| 항목 | 결과 |
|---|---|
| 원본 vs 마스킹본이 다름 | ✅ `redacted_differs_from_original: true` |
| 원본 객체 비변형 (마스킹 탭 봤다가 원본 탭 재확인) | ✅ `original_unmutated_after_viewing_redacted: true` |
| 키 순서가 달라도 동일 커밋먼트 (`canonicalize.test.ts`) | ✅ 통과 |
| 필드 1개 변조 → 커밋먼트 값 다름 | ✅ `tamper_changes_commitment: true` |
| 미변조 영수증 → VERIFIED | ✅ |
| 변조본 → VERIFICATION FAILED | ✅ |

**사소한 관찰 사항 (Confirmed by execution, 결함 아님)**: Playwright가 `POST /api/events` 요청 2건을 `net::ERR_ABORTED`로 기록했습니다. 그러나 `/metrics`를 직접 curl로 조회해 카운터 증가분(`receipts_created_total`, `verifications_total`, `verification_failures_total`)이 정확히 일치함을 확인했고, 이는 `fetch(..., {keepalive:true})`를 페이지 전환 중 호출할 때 Playwright의 네트워크 로깅이 갖는 잘 알려진 아티팩트입니다. 서버는 실제로 요청을 정상 처리했습니다.

---

# Docker 결과

**Confirmed by execution** — `docker compose build --no-cache` (캐시 없이 완전 재빌드) → `docker compose up -d` → 헬스체크 `healthy` 전환까지 확인.

```
Image proofops:local Built
proofops-proofops-1   Up (healthy)   0.0.0.0:8787->8787/tcp
```

- `/healthz`, `/readyz` 컨테이너 안에서 정상 응답
- 컨테이너 내부 `whoami` → `proofops` (non-root, uid=100) 확인
- 이미지 안에 `.env`, 소스코드(.ts), `docs/`, `contract/` 없음 — 프로덕션 산출물만 존재 확인
- 이미지 크기 247MB (node:22-alpine 기반, 합리적 수준)
- 컨테이너 위에서 데모 전체 플로우(Load→Analyze→Redact→Receipt→Verify→Tamper)를 Playwright로 재구동 → 전부 통과

---

# Midnight 실제 연동 상태

**Confirmed by execution (이번 세션에서 완전 삭제 후 재빌드/재테스트)**

- `contract/dist`, `contract/node_modules`를 삭제하고 `npm run contract:build` → 실제 공식 컴파일러(0.31.1)로 재컴파일 성공, 진짜 proving key(`submitReceipt.prover`, 284KB) 재생성 확인
- `npm run contract:test` → 6/6 통과 (실 `@midnight-ntwrk/compact-runtime` 0.16.0 기반)
- 컴파일된 `index.js`를 코드로 파싱해 `assert()`가 모든 ledger write보다 먼저 실행됨을 프로그램적으로 재확인 (`assert index: 15429 < first write: 15736`)
- `Ledger` 타입에 정확히 5개 필드만 있고 private response time은 없음을 재확인
- `compact --version`, `--language-version`, `--ledger-version`을 재실행해 `docs/MIDNIGHT_STATUS.md`에 적힌 버전(devtools 0.5.1 / compiler 0.31.1 / language 0.23.0 / ledger-8.0.2)과 **완전히 일치**함을 확인

**Confirmed by execution — Midnight 모드 UI 동작**: `VITE_PROOF_PROVIDER=midnight`로 실제 빌드해서 별도 서버로 구동 후 Playwright로 확인 —
- 배지: `MIDNIGHT NETWORK` (LOCAL DEMO MODE 아님)
- "Generate Verification Receipt" 클릭 → `LOCAL_DEMO`도 `MIDNIGHT_CONFIRMED`도 주장하지 않고, "Midnight transaction submission is not implemented in this build..." 명확한 에러 텍스트 표시 (스크린샷으로 육안 확인 완료)

**Not confirmed / 실제로 안 된 것**: 지갑 연동, 실제 트랜잭션 제출, devnet/testnet 배포 — 이는 원래부터 "안 됨"으로 문서화되어 있고 이번 검토에서도 코드상 그 경로가 전혀 구현되어 있지 않음을 재확인했습니다(허위 트랜잭션 ID 생성 코드 없음, grep으로 확인).

---

# Local Demo 상태

- `LocalDemoProofProvider`가 만드는 모든 영수증은 `status: "LOCAL_DEMO"`만 가능 — 소스에 `MIDNIGHT_CONFIRMED`/`MIDNIGHT_PENDING`을 실제로 대입하는 코드가 전혀 없음 (grep으로 확인, Confirmed by source inspection)
- UI 배지, 영수증 카드, 경고 문구 3곳에서 모두 "로컬/온체인 아님"을 일관되게 표시 (Confirmed by execution, 스크린샷 확인)
- 로컬 모드와 Midnight 모드가 **서로 다른 배지, 서로 다른 provider 값, 서로 다른 에러/성공 결과**로 명확히 구분됨 → 혼동 불가능 (Confirmed by execution)

---

# 보안 점검

**Confirmed by execution — 리포지토리 전체 grep**
- 실제 자격증명/개인키 패턴 (`-----BEGIN ... PRIVATE KEY-----`): 없음
- 유효한 형식의 AKIA/ASIA 20자 AWS 키: 없음 (샘플 데이터는 `AKIAEXAMPLE1234`, `ASIAEXAMPLE7788`처럼 AWS 공식 "EXAMPLE" 관례를 따라 의도적으로 무효 형식)
- 가짜 트랜잭션 ID, "deployed to mainnet/testnet" 류 주장: 없음
- TODO/FIXME/XXX (node_modules 제외): 없음
- 서버 로그(`server/logger.ts` 전체 호출부 확인) — type/port/signal/error message만 기록, 요청 바디·인시던트 데이터 없음
- `/metrics` 응답에 ARN·IP·계정ID 패턴 없음 (정규식으로 재확인)

**Confirmed by execution — npm audit**
- `npm audit --omit=dev` → **0 vulnerabilities** (프로덕션 의존성은 깨끗함)
- 전체 audit → 6건(모더레이트 3, 하이 1, 크리티컬 2) 전부 **devDependency인 esbuild/vite/vitest 체인**(GHSA-67mh-4wv8-2f99 — "vite 개발서버가 임의 웹사이트로부터의 요청을 받아들이는" 이슈)에 한정, 프로덕션 빌드·Docker 런타임에는 포함되지 않음

---

# 남은 문제

1. **dev 전용 npm audit 취약점 (esbuild/vite/vitest, 6건)** — 의도적으로 강제 업그레이드하지 않았습니다. `npm audit fix --force`는 vite/vitest를 브레이킹 메이저 버전으로 올리며, 이번 검토에서 이미 검증된 빌드/테스트 파이프라인 전체를 재검증 없이 흔들 위험이 있습니다. 이 취약점은 로컬 dev 서버가 떠 있는 상태에서 악성 웹사이트가 접근해야 하는 시나리오로, 프로덕션 Docker 런타임에는 영향이 없습니다. → **의도적 미조치, 트레이드오프 명시**.
2. **지갑/실 트랜잭션 연동 미구현** — 기존에 문서화된 그대로이며, 이번에도 우회하거나 허위로 채우지 않았습니다.
3. `.env.example`, README의 PowerShell 명령 등은 전부 실행 확인했지만, **`docker compose` 명령 자체는 Git Bash에서 실행**했습니다 (PowerShell에서 별도로 재실행하진 않음 — `docker` CLI는 셸에 무관하게 동일 바이너리를 호출하므로 위험은 낮다고 판단, Not confirmed 항목으로 명시).

---

# 3분 데모 순서

`docs/DEMO_SCRIPT.md`와 동일 (변경 없음, 이번 검토로 각 단계가 실제로 그렇게 동작함을 재확인):

1. 문제 제기 (30s) → 2. Load Demo Incident (15s) → 3. Analyze Privately → HIGH/8min/15min/satisfied:true 확인 (25s) → 4. Privacy Preview 탭 전환으로 원본 vs 마스킹 비교 (25s) → 5. Generate Verification Receipt → LOCAL_DEMO 배지 확인 (20s) → 6. Verify Current Evidence → VERIFIED (15s) → 7. Tamper a Field & Verify (20s) → 8. VERIFICATION FAILED + 커밋먼트 불일치 표시 (15s) → 9. Midnight 프라이버시 설명 (25s) → 10. SRE/보안팀 임팩트 (10s)

---

# 제출 전 체크리스트

| 항목 | 상태 |
|---|---|
| `npm ci` | ✅ Confirmed by execution |
| typecheck / lint | ✅ Confirmed by execution |
| 유닛 테스트 31개 | ✅ Confirmed by execution |
| 프로덕션 빌드 | ✅ Confirmed by execution |
| `/healthz` `/readyz` `/metrics` | ✅ Confirmed by execution (Bash + PowerShell 양쪽) |
| Docker no-cache 빌드 + healthy | ✅ Confirmed by execution |
| 샘플 인시던트 정확한 값 4종 | ✅ Confirmed by execution |
| 프라이버시/변조 탐지 6개 시나리오 | ✅ Confirmed by execution |
| 시크릿/플레이스홀더/가짜 배포 주장 없음 | ✅ Confirmed by execution (grep 전수조사) |
| 컨트랙트 실컴파일 + 실테스트 (완전 삭제 후 재생성) | ✅ Confirmed by execution |
| `MIDNIGHT_STATUS.md` 사실 일치 | ✅ Confirmed by execution (오타 1건 수정) |
| Local/Midnight 모드 UI 혼동 불가 | ✅ Confirmed by execution (양쪽 빌드 실사용) |
| README PowerShell 명령 | ✅ Confirmed by execution (install/build/start/test/typecheck/lint) |
| 파일 추적/무시 정합성 | ✅ Confirmed by execution (`git status`, `check-ignore`) |
| dev-only npm audit 취약점 | ⚠️ 알려진 채로 남김 (트레이드오프 명시, 위 참조) |
| 실제 커밋 생성 | ⏸ 수행 안 함 (요청 시 진행) |

**최종 `git status` / `git diff --stat`**
```
On branch master
No commits yet
Changes to be committed: (69 new files)

git diff --stat (unstaged): 없음 — working tree == staged index
git diff --cached --stat 요약: 69 files changed, 14591 insertions(+)
```

`node_modules/`, `dist/`, `dist-server/`, `contract/dist/`, `contract/node_modules/`, `.env`, `*.log`, `.playwright-shots/` 전부 `.gitignore`로 정상 제외됨을 `git check-ignore -v`로 확인했습니다.
