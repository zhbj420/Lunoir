// Русский. Partial on purpose — any missing key falls back to English.
// Cyrillic, but Segoe UI covers it fully, so no font work is needed.
// Not translated: brand name (Lunoir), format/codec names, channel layouts,
// font family names.
import type { Key } from './en'

export const ru: Partial<Record<Key, string>> = {
  'win.minimize': 'Свернуть',
  'win.maximize': 'Развернуть',
  'win.close': 'Закрыть',

  'empty.tagline': 'Перетащите видео для воспроизведения',
  'empty.urlPlaceholder': 'Вставьте URL видео или потока…',
  'empty.urlPlay': 'Воспроизвести',
  'empty.openFile': 'Открыть файл',
  'empty.hint': 'Двойной щелчок — папка · правый щелчок — URL',

  'osc.mute': 'Без звука',
  'osc.unmute': 'Включить звук',
  'osc.play': 'Воспроизвести',
  'osc.pause': 'Пауза',
  'osc.back': 'Назад на {n} с',
  'osc.forward': 'Вперёд на {n} с',
  'osc.panel': 'Дорожки и плейлист',
  'osc.timeFormat': 'Клик для переключения: время · таймкод · кадр',

  'common.settings': 'Настройки',
  'common.close': 'Закрыть',
  'osc.library': 'Сохранённое и недавнее',
  'lib.favourites': 'Сохранённое',
  'lib.recent': 'Недавнее',
  'lib.emptyRecent': 'Пока ничего не воспроизводилось.',
  'lib.emptyFav': 'Пока ничего не сохранено. Щёлкните правой кнопкой во время воспроизведения, чтобы сохранить.',
  'lib.addFav': 'Сохранить',
  'lib.remove': 'Удалить',
  'lib.rename': 'Переименовать',
  'lib.back': 'Назад',
  'lib.emptyList': 'Этот список пуст',
  'lib.playlists': 'Плейлисты',
  'lib.live': 'Эфир',
  'lib.emptyPlaylists': 'Пока нет сохранённых плейлистов. Сохраните из панели плейлиста.',
  'lib.emptyLive': 'Пока нет сохранённых источников эфира.',
  'common.collapse': 'Свернуть панель',
  'common.default': 'По умолчанию',

  'set.sec.interface': 'Интерфейс',
  'set.sec.playlist': 'Плейлист',
  'set.sec.audioSubs': 'Аудио и субтитры',
  'set.sec.subAppearance': 'Вид субтитров',
  'set.sec.video': 'Видео',
  'set.sec.screenshots': 'Скриншоты',
  'set.sec.controls': 'Управление',
  'set.sec.window': 'Окно',

  'set.uiLang.label': 'Язык интерфейса',
  'set.uiLang.desc':
    'Язык меню и настроек Lunoir. Не связан с предпочитаемыми языками аудио и субтитров ниже, которые выбирают дорожки внутри видео.',

  'set.scanFolder.label': 'Сканировать папку в плейлист',
  'set.scanFolder.desc':
    'При открытии файла добавлять в очередь и остальные видео из его папки.',
  'set.resume.label': 'Возобновлять воспроизведение',
  'set.resume.desc':
    'Запоминать позицию в каждом файле и возвращаться к ней при повторном открытии.',
  'set.resumePlaylist.label': 'Возобновлять плейлисты',
  'set.resumePlaylist.desc':
    'Повторное открытие ссылки на плейлист возвращает к последнему просмотренному видео.',

  'set.keepPitch.label': 'Сохранять высоту тона при смене скорости',
  'set.keepPitch.desc':
    'Растягивать аудио по времени, чтобы голоса сохраняли естественную высоту на повышенной скорости.',
  'set.passthrough.label': 'Аудио passthrough',
  'set.passthrough.desc':
    'Отправлять сжатое аудио потоком на внешний ресивер или ЦАП, который декодирует его вместо Lunoir.\nТребуется оборудование с поддержкой формата. Неподдерживаемые форматы будут без звука.',
  'set.audioLang.label': 'Предпочитаемый язык аудио',
  'set.subLang.label': 'Предпочитаемый язык субтитров',
  'set.audioLang.desc':
    'Автоматически выбирать этот язык при открытии файла.\nПо умолчанию — порядок дорожек в файле.',
  'set.subLang.desc':
    'Автоматически выбирать этот язык при открытии файла.\nПо умолчанию — порядок дорожек в файле.',
  'set.subsDefault.label': 'Субтитры включены по умолчанию',
  'set.autoLoadSubs.label': 'Автозагрузка внешних субтитров',
  'set.autoLoadSubs.desc':
    'Загружать подходящие файлы .srt и .ass рядом с видео.',
  'set.hdrSubPeak.label': 'Яркость субтитров HDR',
  'set.hdrSubPeak.desc':
    'Пиковая яркость (в нитах) текстовых субтитров (SRT/ASS) поверх HDR-видео. Чем ниже значение, тем тусклее.\nГрафические субтитры (PGS, как на Blu-ray) не поддерживаются mpv. Воспроизведение SDR не затрагивается.',

  'set.subFont.label': 'Шрифт',
  'set.subFont.desc':
    'Применяется к текстовым субтитрам (SRT/ASS без собственного стиля). Выберите шрифт, полностью покрывающий язык субтитров; отсутствующие глифы переключаются на другой шрифт посреди фразы.',
  'set.subSize.label': 'Размер шрифта',
  'set.subSpacing.label': 'Межбуквенный интервал',
  'set.subSpacing.desc': 'Дополнительный интервал между символами.',
  'set.subOutline.label': 'Обводка',
  'set.subOutline.desc':
    'Толщина тёмной обводки, которая сохраняет читаемость субтитров на ярких сценах.',
  'set.subBold.label': 'Полужирный',
  'set.subMargin.label': 'Отступ снизу',
  'set.subMargin.desc':
    'Положение по умолчанию. «Настроить ▸ положение субтитров» в правой панели смещает текущее видео, не меняя это значение.',

  'set.hwdec.label': 'Аппаратное декодирование',
  'set.hwdec.auto': 'Декодирование на GPU. Наиболее эффективно: кадры остаются в видеопамяти.',
  'set.hwdec.autoCopy':
    'Декодирование на GPU с копированием кадров обратно в системную память. Нужно для CPU-фильтров вроде SVP.',
  'set.hwdec.off': 'Программное декодирование на CPU. Наиболее совместимо, но тяжелее.',
  'set.quality.label': 'Качество онлайн-видео',
  'set.quality.desc':
    'Верхний предел. Реальное качество зависит от источника: видео с пределом 1080p воспроизводится в 1080p независимо от этой настройки. «Лучшее» выбирает наивысшее качество, доступное в источнике. Применяется к следующему потоку.',
  'set.cookies.label': 'Использовать куки браузера',
  'set.cookies.desc':
    'Читает куки из браузера с активным входом, чтобы воспроизводить видео для участников, с возрастным ограничением и Premium. По умолчанию отключено.',
  'set.cookiesFrom.label': 'Куки из',

  'set.shotSubs.label': 'Включать субтитры',
  'set.shotSubs.desc': 'Включать экранные субтитры в сохранённое изображение.',
  'set.shotFormat.label': 'Формат',
  'set.shotFormat.desc':
    'PNG без потерь. JPG даёт намного меньшие файлы при качестве 95, где потери почти незаметны.',
  'set.shotDir.label': 'Папка сохранения',
  'set.shotDir.desc':
    'Куда сохраняются скриншоты. Введите путь или выберите.',
  'set.shotDir.browse': 'Обзор…',

  'set.oscDelay.label': 'Задержка автоскрытия',
  'set.oscDelay.desc1':
    'Как долго экранные элементы управления остаются видимыми после остановки указателя.',
  'set.oscDelay.desc2': 'По умолчанию: 5 секунд.',

  'set.rememberWindow.label': 'Запоминать размер и положение',
  'set.rememberVolume.label': 'Запоминать громкость',

  'opt.hwdec.auto': 'Авто',
  'opt.hwdec.autoCopy': 'Авто (с копированием)',
  'opt.hwdec.off': 'Выкл. (программно)',
  'opt.quality.best': 'Лучшее',
  'opt.shot.png': 'PNG (без потерь)',
  'opt.shot.jpg': 'JPG (высокое качество)',
  'opt.subFont.system': 'Системный по умолчанию (sans-serif)',
  'opt.lang.english': 'Английский',
  'opt.lang.chinese': 'Китайский',
  'opt.lang.japanese': 'Японский',
  'opt.lang.korean': 'Корейский',
  'opt.lang.french': 'Французский',
  'opt.lang.german': 'Немецкий',
  'opt.lang.spanish': 'Испанский',
  'opt.lang.italian': 'Итальянский',
  'opt.lang.russian': 'Русский',
  'opt.lang.portuguese': 'Португальский',
  'opt.uiLang.system': 'Система',

  'panel.tab.audioSub': 'Аудио и суб.',
  'panel.tab.playlist': 'Плейлист',
  'panel.tab.channels': 'Каналы',
  'panel.tab.chapters': 'Главы',

  'panel.empty.queue': 'Очередь пуста',
  'panel.repeat.off': 'Повтор: выкл.',
  'panel.repeat.all': 'Повтор: все',
  'panel.repeat.one': 'Повтор: один',
  'panel.shuffle.on': 'Случайно: вкл.',
  'panel.shuffle.off': 'Случайно: выкл.',
  'panel.addFiles': 'Добавить файлы',
  'panel.savePlaylist': 'Сохранить плейлист',
  'panel.saveSource': 'Сохранить источник',
  'panel.searchChannels': 'Поиск каналов',
  'panel.ungrouped': 'Без группы',
  'panel.noMatches': 'Нет совпадений',
  'panel.removeCurrent': 'Убрать текущий',

  'panel.empty.chapters': 'Нет глав',
  'panel.chapterN': 'Глава {n}',

  'panel.sec.audio': 'Аудио',
  'panel.sec.subtitles': 'Субтитры',
  'panel.empty.audio': 'Нет аудиодорожек',
  'panel.subNone': 'Нет',
  'panel.addSub': 'Добавить субтитры…',
  'panel.trackN': 'Дорожка {n}',

  'adjust.label': 'Настроить',
  'adjust.active': 'Есть изменения',
  'adjust.reset': 'Сбросить',
  'adjust.delay': 'Задержка',
  'adjust.position': 'Положение',
  'adjust.size': 'Размер',
  'adjust.brightness': 'Яркость',
  'adjust.earlier': 'Раньше (−0,1 с)',
  'adjust.later': 'Позже (+0,1 с)',
  'adjust.moveUp': 'Выше',
  'adjust.moveDown': 'Ниже',
  'adjust.smaller': 'Меньше',
  'adjust.larger': 'Больше',
  'adjust.dimmer': 'Тусклее',
  'adjust.brighter': 'Ярче',
  'adjust.imageSubHint': 'Графические субтитры — только положение и задержка',

  'menu.previous': 'Предыдущий',
  'menu.next': 'Следующий',
  'menu.prevChapter': 'Предыдущая глава',
  'menu.nextChapter': 'Следующая глава',
  'menu.speed': 'Скорость',
  'menu.speedNormal': 'Обычная',
  'menu.aspect': 'Соотношение сторон',
  'menu.aspectStretch': 'Растянуть на весь экран',
  'menu.abStart': 'Цикл A-B: начало (A)',
  'menu.abEnd': 'Цикл A-B: конец (B)',
  'menu.abClear': 'Цикл A-B: сбросить',
  'menu.screenshot': 'Скриншот',
  'menu.tcOverlay': 'Таймкод поверх видео',
  'menu.favourite': 'Добавить в библиотеку',
  'menu.openFile': 'Открыть файл…',
  'menu.openUrl': 'Открыть URL…',
  'menu.fullscreen': 'Во весь экран',

  'toast.speedNormal': 'Обычная скорость',
  'toast.speed': 'Скорость {v}×',
  'toast.screenshotSaved': 'Скриншот сохранён в Изображения › Lunoir',
  'toast.loading': 'Загрузка…',

  'main.fetchingYtdl': 'Загрузка yt-dlp…',
  'main.ytdlFailed': 'Не удалось загрузить yt-dlp',
  'main.loadingPlaylist': 'Загрузка плейлиста…',
  'main.playlistFailed': 'Не удалось загрузить плейлист',
  'main.noMedia': 'В этой папке нет воспроизводимых медиа',
  'main.skippedMissing': 'Пропущен отсутствующий файл',
  'main.noPlayable': 'Файл не найден — проверьте файл',
  'main.loadFailed': 'Не удаётся воспроизвести — источник может быть недоступен',
  'main.folderTruncated':
    'В папке {count} видео — загружаются первые {max}',
  'main.resumed': 'Продолжено с {time}',
  'dlg.selectFolder': 'Выберите папку (папку с видео или диск Blu-ray/DVD)',
  'dlg.addSubtitle': 'Добавить субтитры',
  'dlg.addToPlaylist': 'Добавить в плейлист',
  'dlg.openMedia': 'Открыть медиа',
  'dlg.chooseShotDir': 'Выбрать папку для скриншотов',
  'dlg.filter.subtitles': 'Субтитры',
  'dlg.filter.media': 'Медиа',
  'dlg.filter.allFiles': 'Все файлы',

  'appmenu.file': 'Файл',
  'appmenu.open': 'Открыть…',
  'appmenu.openFolder': 'Открыть папку…',
  'appmenu.view': 'Вид',

  'common.restoreDefault': 'Сбросить по умолчанию',
  'set.sec.appearance': 'Оформление',
  'set.frost.label': 'Прозрачность матового стекла',
  'set.frost.desc':
    'Насколько панели и экранные элементы пропускают видео сквозь матовое стекло. Выше — прозрачнее, ниже — плотнее.',

  'menu.record': 'Начать запись',
  'menu.stopRecord': 'Остановить запись',
  'toast.recordingSaved': 'Запись сохранена: {name}',
  'toast.favourited': 'Добавлено в библиотеку',
  'toast.alreadyFav': 'Уже в библиотеке',
  'toast.unfavourited': 'Удалено из библиотеки',
  'dlg.chooseRecDir': 'Выбрать папку для записей',
  'set.recDir.label': 'Папка для записей',
  'set.recDir.desc':
    'Куда сохраняются записи трансляций. Введите путь или выберите.',
  // ---- updates ----
  'set.sec.about': 'О программе',
  'set.update.label': 'Версия',
  'set.update.check': 'Проверить обновления',
  'set.autoUpdate.label': 'Проверять при запуске',
  'set.autoUpdate.desc': 'Незаметно проверять наличие новой версии при запуске Lunoir.',
  'update.newVersion': 'Доступна новая версия',
  'update.clickToDownload': 'Нажмите для загрузки',
  'update.current': 'Текущая версия {version}',
  'update.checking': 'Проверка…',
  'update.latest': 'У вас последняя версия',
  'update.found': 'Доступна новая версия {version}',
  'update.checkFailed': 'Не удалось проверить — повторите позже',
  'update.download': 'Загрузить',
  // ---- timeline ----
  'panel.merge.on': 'Таймлайн: вкл',
  'panel.merge.off': 'Таймлайн: выкл',
  'timeline.title': 'Таймлайн',
  // ---- experimental ----
  'set.sec.experimental': 'Экспериментальное',
  'set.timeline.label': 'Таймлайн',
  'set.timeline.desc':
    'Сшивает локальные файлы из плейлиста в одно непрерывное видео с единой шкалой времени и полосой перемотки — чтобы смотреть папку клипов от начала до конца.\nВоспроизведение может слегка подёргиваться на стыке клипов разных форматов. Когда включено, в панели плейлиста появляется переключатель.',
  'timeline.resetRange': 'Сбросить диапазон',
  // ---- trim ----
  'set.pinOscTrim.label': 'Показывать элементы управления при обрезке',
  'set.pinOscTrim.desc': 'При установке точек входа/выхода фрагмента не скрывать автоматически экранные элементы управления, чтобы маркеры оставались доступными.',
}
