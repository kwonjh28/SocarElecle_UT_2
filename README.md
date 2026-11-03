# 쏘카일레클 모바일 UT

Q1~Q4 → Q5 이용 상황(최대 3개) → 프로토타입 체험 → Q6 → 완료. 모든 표시 문항은 필수입니다. Q3 ‘없다’는 Q4를 생략하고 0회로 저장합니다. 이름·전화번호·이메일 필드는 없습니다. UT 지표 수집은 아직 추가하지 않았습니다. 체험 종료는 참가자가 ‘체험 마치기’를 누릅니다.

## 현재 미리보기

config.js의 endpoint가 비어 있으면 미리보기입니다. ID는 PREVIEW-P01 형식이며 브라우저 내에서만 발급합니다. 실제 시트에 저장되었다고 표시하지 않습니다. 응답은 해당 기기 localStorage에 남습니다. 새로고침 시 sessionStorage의 진행 상태를 복원합니다.

## 실제 Google Sheets 연결

1. 전달한 스프레드시트에서 확장 프로그램 → Apps Script를 엽니다.
2. Code.gs 내용을 붙여넣습니다. 스프레드시트 ID는 이미 설정되어 있습니다.
3. 배포 → 새 배포 → 웹 앱을 선택합니다. 실행 주체는 본인, 접근 권한은 참가자가 로그인 없이 접속 가능한 ‘모든 사용자’로 설정합니다. Google 계정 권한 승인과 배포는 소유자가 진행합니다.
4. 발급된 /exec URL을 config.js의 endpoint에 넣습니다.
5. UT_responses 탭이 자동 생성됩니다. 시트에 공개 편집 권한을 줄 필요는 없습니다.

서버에서 LockService로 발급을 직렬화하므로 여러 기기에서도 P01, P02 순번이 중복되지 않습니다. 중단한 참가자도 번호를 사용하므로 완료 응답 사이에 결번이 있을 수 있습니다. 같은 세션 재전송은 기존 행을 갱신합니다. 연결 실패 시 재시도할 수 있고 성공 확인 후에만 완료를 표시합니다. 임의 외부 요청을 제한하는 인증/스팸 방지는 아직 없어 소규모 UT용입니다.

## 배포

GitHub Pages 배포 파일: index.html, style.css, survey.js, config.js, prototype/ 전체. 모든 경로는 상대 경로로 하위 경로 배포를 지원합니다. Code.gs, README.md, prototype-src/는 배포할 필요가 없습니다.

프로토타입 수정: prototype-src에서 npm install 후 npm run build. 빌드 결과는 prototype/에 생성됩니다. 원본 Figma 내보내기 파일은 변경하지 않았습니다.

연령대는 age_group에 저장하며 기존 age 열은 과거 데이터 보존용으로 유지합니다. 신규 응답의 age는 비워 둡니다. 이용 상황은 usage_situations, 기타는 usage_other에 저장합니다. usage_question_type은 experienced(경험자) 또는 expected(미경험자)입니다. Apps Script를 이미 배포했다면 Code.gs를 교체하고 새 버전으로 다시 배포해야 합니다.
