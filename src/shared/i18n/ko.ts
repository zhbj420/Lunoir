// 한국어. Partial on purpose — any missing key falls back to English.
// Rendered with the system Malgun Gothic (ships with Windows), NOT the bundled
// SC subset.
// Not translated: brand name (Lunoir), format/codec names, channel layouts,
// font family names.
import type { Key } from './en'

export const ko: Partial<Record<Key, string>> = {
  'win.minimize': '최소화',
  'win.maximize': '최대화',
  'win.close': '닫기',

  'empty.tagline': '동영상을 끌어다 놓아 재생',
  'empty.urlPlaceholder': '동영상 또는 스트림 URL 붙여넣기…',
  'empty.urlPlay': '재생',
  'empty.openFile': '파일 열기',
  'empty.hint': '더블클릭은 폴더 · 우클릭은 URL',

  'osc.mute': '음소거',
  'osc.unmute': '음소거 해제',
  'osc.play': '재생',
  'osc.pause': '일시정지',
  'osc.back': '{n}초 뒤로',
  'osc.forward': '{n}초 앞으로',
  'osc.panel': '트랙 및 재생목록',
  'osc.timeFormat': '클릭하여 전환: 시간 · 타임코드 · 프레임',

  'common.settings': '설정',
  'common.collapse': '패널 접기',
  'common.default': '기본값',

  'set.sec.interface': '인터페이스',
  'set.sec.playlist': '재생목록',
  'set.sec.audioSubs': '오디오 및 자막',
  'set.sec.subAppearance': '자막 모양',
  'set.sec.video': '비디오',
  'set.sec.screenshots': '스크린샷',
  'set.sec.controls': '컨트롤',
  'set.sec.window': '창',

  'set.uiLang.label': '인터페이스 언어',
  'set.uiLang.desc':
    'Lunoir 메뉴와 설정에 사용되는 언어입니다. 아래의 선호 오디오·자막 언어와는 별개이며, 그쪽은 동영상 내 트랙을 선택합니다.',

  'set.scanFolder.label': '폴더를 재생목록에 스캔',
  'set.scanFolder.desc':
    '파일을 열 때 같은 폴더의 다른 동영상도 대기열에 추가합니다.',
  'set.resume.label': '재생 위치 기억',
  'set.resume.desc':
    '각 파일의 재생 위치를 기억하고 다시 열 때 그 지점으로 돌아갑니다.',
  'set.resumePlaylist.label': '재생목록 위치 기억',
  'set.resumePlaylist.desc':
    '재생목록 링크를 다시 열면 마지막으로 본 동영상으로 돌아갑니다.',

  'set.keepPitch.label': '속도 변경 시 음정 유지',
  'set.keepPitch.desc':
    '오디오를 시간축으로 늘려 빠른 재생에서도 목소리의 자연스러운 음정을 유지합니다.',
  'set.passthrough.label': '오디오 패스스루',
  'set.passthrough.desc':
    '압축 오디오를 비트스트림으로 외부 리시버나 DAC에 보내 Lunoir 대신 그쪽에서 디코딩합니다.\n해당 형식을 지원하는 하드웨어가 필요합니다. 지원하지 않는 형식은 소리가 나지 않습니다.',
  'set.audioLang.label': '선호 오디오 언어',
  'set.subLang.label': '선호 자막 언어',
  'set.audioLang.desc':
    '파일을 열 때 이 언어의 오디오를 자동 선택합니다.\n기본값은 파일 자체의 트랙 순서입니다.',
  'set.subLang.desc':
    '파일을 열 때 이 언어의 자막을 자동 선택합니다.\n기본값은 파일 자체의 트랙 순서입니다.',
  'set.subsDefault.label': '기본적으로 자막 표시',
  'set.autoLoadSubs.label': '외부 자막 자동 로드',
  'set.autoLoadSubs.desc':
    '동영상 옆에 있는 같은 이름의 .srt 및 .ass 파일을 로드합니다.',
  'set.hdrSubPeak.label': 'HDR 자막 밝기',
  'set.hdrSubPeak.desc':
    'HDR 영상 위 텍스트 자막(SRT/ASS)의 최대 휘도(니트). 값이 낮을수록 어둡습니다.\n이미지 자막(블루레이의 PGS 등)은 mpv에서 지원하지 않습니다. SDR 재생에는 영향이 없습니다.',

  'set.subFont.label': '글꼴',
  'set.subFont.desc':
    '자체 스타일이 없는 텍스트 자막(SRT/ASS)에 적용됩니다. 자막 언어를 완전히 지원하는 글꼴을 선택하세요. 빠진 글자는 문장 도중에 다른 글꼴로 바뀝니다.',
  'set.subSize.label': '글꼴 크기',
  'set.subSpacing.label': '자간',
  'set.subSpacing.desc': '문자 사이의 추가 간격.',
  'set.subOutline.label': '외곽선',
  'set.subOutline.desc':
    '밝은 장면에서도 자막을 읽기 쉽게 유지하는 어두운 테두리의 두께.',
  'set.subBold.label': '굵게',
  'set.subMargin.label': '아래에서의 거리',
  'set.subMargin.desc':
    '기본 위치입니다. 오른쪽 패널의 「조정 ▸ 자막 위치」는 현재 동영상만 이동시키며 이 값은 바꾸지 않습니다.',

  'set.hwdec.label': '하드웨어 디코딩',
  'set.hwdec.auto': 'GPU 디코딩. 프레임이 비디오 메모리에 남아 가장 효율적입니다.',
  'set.hwdec.autoCopy':
    'GPU 디코딩 후 프레임을 시스템 메모리로 다시 복사합니다. SVP 같은 CPU 필터에 필요합니다.',
  'set.hwdec.off': 'CPU 소프트웨어 디코딩. 호환성은 가장 높지만 부하가 큽니다.',
  'set.quality.label': '온라인 동영상 화질',
  'set.quality.desc':
    '상한값입니다. 실제 화질은 소스에 따라 다르며, 1080p 상한 동영상은 이 설정과 무관하게 1080p로 재생됩니다. 「최고」는 소스가 제공하는 최고 화질을 선택합니다. 다음 스트림부터 적용됩니다.',
  'set.cookies.label': '브라우저 쿠키 사용',
  'set.cookies.desc':
    '로그인한 브라우저의 쿠키를 읽어 멤버십·연령 제한·Premium 동영상을 재생할 수 있게 합니다. 기본적으로 비활성화됩니다.',
  'set.cookiesFrom.label': '쿠키 출처',

  'set.shotSubs.label': '자막 포함',
  'set.shotSubs.desc': '화면의 자막을 저장 이미지에 포함합니다.',
  'set.shotFormat.label': '형식',
  'set.shotFormat.desc':
    'PNG는 무손실입니다. JPG는 품질 95에서 파일이 훨씬 작아지며 손실은 거의 보이지 않습니다.',
  'set.shotDir.label': '저장 폴더',
  'set.shotDir.desc':
    '스크린샷이 저장되는 위치. 경로를 입력하거나 찾아보세요.',
  'set.shotDir.browse': '찾아보기…',

  'set.oscDelay.label': '자동 숨김 지연',
  'set.oscDelay.desc1':
    '포인터가 멈춘 후 화면 컨트롤이 계속 표시되는 시간.',
  'set.oscDelay.desc2': '기본값: 5초.',

  'set.rememberWindow.label': '크기와 위치 기억',
  'set.rememberVolume.label': '음량 기억',

  'opt.hwdec.auto': '자동',
  'opt.hwdec.autoCopy': '자동(메모리로 복사)',
  'opt.hwdec.off': '끄기(소프트웨어)',
  'opt.quality.best': '최고',
  'opt.shot.png': 'PNG(무손실)',
  'opt.shot.jpg': 'JPG(고품질)',
  'opt.subFont.system': '시스템 기본(sans-serif)',
  'opt.lang.english': '영어',
  'opt.lang.chinese': '중국어',
  'opt.lang.japanese': '일본어',
  'opt.lang.korean': '한국어',
  'opt.lang.french': '프랑스어',
  'opt.lang.german': '독일어',
  'opt.lang.spanish': '스페인어',
  'opt.lang.italian': '이탈리아어',
  'opt.lang.russian': '러시아어',
  'opt.lang.portuguese': '포르투갈어',
  'opt.uiLang.system': '시스템',

  'panel.tab.audioSub': '오디오·자막',
  'panel.tab.playlist': '재생목록',
  'panel.tab.chapters': '챕터',

  'panel.empty.queue': '대기열 비어 있음',
  'panel.repeat.off': '반복: 끄기',
  'panel.repeat.all': '반복: 전체',
  'panel.repeat.one': '반복: 하나',
  'panel.shuffle.on': '셔플: 켜기',
  'panel.shuffle.off': '셔플: 끄기',
  'panel.addFiles': '파일 추가',
  'panel.removeCurrent': '현재 항목 제거',

  'panel.empty.chapters': '챕터 없음',
  'panel.chapterN': '챕터 {n}',

  'panel.sec.audio': '오디오',
  'panel.sec.subtitles': '자막',
  'panel.empty.audio': '오디오 트랙 없음',
  'panel.subNone': '없음',
  'panel.addSub': '자막 추가…',
  'panel.trackN': '트랙 {n}',

  'adjust.label': '조정',
  'adjust.active': '조정 적용됨',
  'adjust.reset': '초기화',
  'adjust.delay': '지연',
  'adjust.position': '위치',
  'adjust.size': '크기',
  'adjust.brightness': '밝기',
  'adjust.earlier': '앞당기기(−0.1초)',
  'adjust.later': '늦추기(+0.1초)',
  'adjust.moveUp': '위로',
  'adjust.moveDown': '아래로',
  'adjust.smaller': '작게',
  'adjust.larger': '크게',
  'adjust.dimmer': '어둡게',
  'adjust.brighter': '밝게',
  'adjust.imageSubHint': '이미지 자막 — 위치와 지연만',

  'menu.previous': '이전',
  'menu.next': '다음',
  'menu.prevChapter': '이전 챕터',
  'menu.nextChapter': '다음 챕터',
  'menu.speed': '속도',
  'menu.speedNormal': '보통',
  'menu.aspect': '화면 비율',
  'menu.aspectStretch': '늘려서 채우기',
  'menu.abStart': 'A-B 반복: 시작 (A)',
  'menu.abEnd': 'A-B 반복: 끝 (B)',
  'menu.abClear': 'A-B 반복: 지우기',
  'menu.screenshot': '스크린샷',
  'menu.tcOverlay': '타임코드 오버레이',
  'menu.openFile': '파일 열기…',
  'menu.openUrl': 'URL 열기…',
  'menu.fullscreen': '전체 화면',

  'toast.speedNormal': '보통 속도',
  'toast.speed': '속도 {v}×',
  'toast.screenshotSaved': '스크린샷을 사진 › Lunoir에 저장했습니다',
  'toast.loading': '로딩 중…',

  'main.fetchingYtdl': 'yt-dlp 가져오는 중…',
  'main.ytdlFailed': 'yt-dlp를 가져오지 못했습니다',
  'main.loadingPlaylist': '재생목록 로딩 중…',
  'main.playlistFailed': '재생목록을 로드하지 못했습니다',
  'main.noMedia': '이 폴더에 재생 가능한 미디어가 없습니다',
  'main.folderTruncated':
    '폴더에 동영상 {count}개 — 처음 {max}개를 로드합니다',
  'main.resumed': '{time}부터 이어서 재생',
  'dlg.selectFolder': '폴더 선택(동영상 폴더 또는 Blu-ray/DVD 디스크)',
  'dlg.addSubtitle': '자막 추가',
  'dlg.addToPlaylist': '재생목록에 추가',
  'dlg.openMedia': '미디어 열기',
  'dlg.chooseShotDir': '스크린샷 폴더 선택',
  'dlg.filter.subtitles': '자막',
  'dlg.filter.media': '미디어',
  'dlg.filter.allFiles': '모든 파일',

  'appmenu.file': '파일',
  'appmenu.open': '열기…',
  'appmenu.openFolder': '폴더 열기…',
  'appmenu.view': '보기',

  'common.restoreDefault': '기본값으로 복원',
  'set.sec.appearance': '모양',
  'set.frost.label': '젖빛 유리 투명도',
  'set.frost.desc':
    '패널과 화면 컨트롤이 젖빛 유리 너머로 영상을 얼마나 비치게 할지. 높을수록 투명하고 낮을수록 불투명합니다.'
}
