// Türkçe arayüz metinleri. Anahtarları İngilizce kaynak dosyayla aynı tutun.
// `Key` türü en.ts dosyasından türetilir; bu dosyadaki anahtarları değiştirmeyin.
//
// Not in here on purpose: the brand name (Lunoir), format/codec names (HDR10,
// Dolby Atmos, DTS:X, PGS, SubRip…), channel layouts and font family names.
// Those read the same in every language and translating them would be wrong.
export const tr = {
  // ---- window controls ----
  'win.minimize': 'Simge durumuna küçült',
  'win.maximize': 'Ekranı kapla',
  'win.close': 'Kapat',

  // ---- empty state (no media loaded) ----
  'empty.tagline': 'Oynatmak için bir videoyu herhangi bir yere bırakın',
  'empty.urlPlaceholder': 'Video veya yayın URL’sini yapıştırın…',
  'osc.audioUnknown': 'Bilinmiyor',
  'osc.audioUnsupported': 'Bu ses biçimi çözümlenemiyor — yalnızca video',
  'url.advanced': 'Gelişmiş',
  'url.userAgent': 'User-Agent (yalnızca kaynak gerektiriyorsa)',
  'empty.urlPlay': 'Oynat',
  'empty.openFile': 'Dosya Aç',
  'empty.hint': 'Klasör açmak için çift tıklayın · URL girmek için herhangi bir yere sağ tıklayın',
  'empty.urlBack': 'Dosya Aç ekranına dönmek için herhangi bir yere sağ tıklayın',

  // ---- OSC ----
  // Mute/unmute and play/pause are separate keys, not one "Play/Pause" label:
  // the button already swaps its icon with state, so the tooltip should follow.
  'osc.mute': 'Sesi kapat',
  'osc.unmute': 'Sesi aç',
  'osc.play': 'Oynat',
  'osc.pause': 'Duraklat',
  'osc.back': '{n} sn geri',
  'osc.forward': '{n} sn ileri',
  // opens the right panel, which is three tabs (Audio & Sub / Playlist /
  // Chapters) and lands on Audio & Sub — so "Playlist" alone undersells it
  'osc.panel': 'Parçalar ve oynatma listesi',
  'osc.timeFormat': 'Zaman · zaman kodu · kare arasında geçiş yapmak için tıklayın',
  'osc.library': 'Kaydedilenler ve son oynatılanlar',

  // ---- shared across surfaces ----
  'common.settings': 'Ayarlar',
  'common.collapse': 'Paneli daralt',
  'common.close': 'Kapat',
  'common.default': 'Varsayılan',
  'common.restoreDefault': 'Varsayılanı geri yükle',

  // ---- kitaplık katmanı: kaydedilen listeler/dosyalar/URL’ler + son oynatılanlar ----
  'lib.favourites': 'Kaydedilenler',
  'lib.recent': 'Son oynatılanlar',
  'lib.emptyRecent': 'Henüz hiçbir şey oynatılmadı.',
  'lib.emptyFav': 'Henüz hiçbir şey kaydedilmedi. Buraya kaydetmek için oynatma sırasında sağ tıklayın.',
  'lib.addFav': 'Kaydet',
  'lib.remove': 'Kaldır',
  'lib.rename': 'Yeniden adlandır',
  'lib.back': 'Geri',
  'lib.emptyList': 'Bu liste boş',
  'lib.playlists': 'Oynatma listeleri',
  'lib.live': 'Canlı',
  'lib.emptyPlaylists': 'Henüz kaydedilmiş oynatma listesi yok. Oynatma listesi panelinden bir liste kaydedin.',
  'lib.emptyLive': 'Henüz kaydedilmiş canlı kaynak yok.',
  'lib.clearRecents': 'Temizle',
  'lib.clearConfirm': 'Tümünü temizle?',

  // ---- settings panel ----
  // Register: plain, complete sentences. State what the setting does and what it
  // costs. No jokes, no winking asides, no "your call".
  'set.sec.interface': 'Arayüz',
  'set.sec.appearance': 'Görünüm',
  'set.sec.playlist': 'Oynatma listesi',
  'set.sec.audio': 'Ses',
  'set.sec.subtitles': 'Altyazılar',
  'set.tab.playback': 'Oynatma',
  'set.tab.subs': 'Altyazılar',
  'set.tab.interface': 'Arayüz',
  'set.tab.general': 'Genel',
  'set.sec.subAppearance': 'Altyazı görünümü',
  'set.sec.video': 'Video',
  'set.sec.enhance': 'Görüntü iyileştirme',
  'set.enhance.label': 'Görüntüyü iyileştir',
  'set.enhance.desc':
    'Aşağıdaki araçların ana açma/kapatma ayarıdır. Kaynak kaliteliyse kapalı bırakın; bu araçlar yalnızca düşük kaliteli TV ve IPTV görüntülerine yardımcı olur, temiz görüntüleri ise yumuşatabilir.\nKapatmak ayarlarınızı silmez; istediğiniz zaman yeniden açabilirsiniz.',
  'set.deblock.label': 'Bloklaşmayı gider',
  'set.deblock.desc':
    'Yoğun biçimde sıkıştırılmış videolardaki bloklaşmayı ve sivrisinek benzeri parazitleri azaltır; özellikle canlı TV ve IPTV yayınlarında yararlıdır.\nYüksek ayarlar daha fazla temizleme sağlar ancak CPU kullanımını artırır. Kaliteli kaynaklarda kapalı bırakın; temiz görüntüleri yumuşatabilir.',
  'opt.deblock.off': 'Kapalı',
  'opt.deblock.low': 'Düşük',
  'opt.deblock.mid': 'Orta',
  'opt.deblock.high': 'Yüksek',
  'set.nr.label': 'Gürültü azaltma',
  'set.nr.desc':
    'Bloklaşma giderme işleminden sonra kalan sıkıştırma parazitlerini ve grenleri yumuşatır. Yalnızca uzamsal işlem uygular; hareketli görüntülerde iz bırakmaz ancak ince ayrıntıları yumuşatabilir.\nGrenli ve parazitli TV görüntülerinde kullanın; temiz kaynaklarda kapalı bırakın.',
  'set.sharpen.label': 'Keskinleştir',
  'set.sharpen.desc': 'Yumuşak ve düşük kaliteli videoyu keskinleştirir. Azı yeterlidir; fazlası gürültüyü yeniden ortaya çıkarır.',
  'set.artcnn.label': 'Ayrıntıları yükselt (ArtCNN)',
  'set.artcnn.desc':
    'Düşük çözünürlüklü kaynaklardaki parlaklık ayrıntılarını sinir ağıyla 2 kat yeniden oluşturur. Yumuşak ve düşük çözünürlüklü videolarda belirgin iyileşme sağlar. Kaynak çözünürlüğünde çalışmaz.\nGPU yükünü artırır; parazitli yayınlardan ziyade temiz ama düşük çözünürlüklü içeriklerde en iyi sonucu verir.',
  'set.cfl.label': 'Renkleri yeniden oluştur (CfL)',
  'set.cfl.desc':
    'Parlaklık kanalından renk ayrıntılarını yeniden oluşturur (chroma-from-luma); 4:2:0 videolarda renk kenarlarını iyileştirir ve renk taşmasını azaltır.\nEtkisi hafiftir; en çok yoğun renkli kenarlarda ve renkli metinlerde fayda sağlar.',
  'set.sec.screenshots': 'Ekran görüntüleri',
  'set.sec.controls': 'Kontroller',
  'set.sec.window': 'Pencere',
  'set.sec.experimental': 'Deneysel',
  'set.sec.about': 'Hakkında',

  'set.uiLang.label': 'Arayüz dili',
  'set.uiLang.desc':
    "Lunoir menülerinde ve ayarlarında kullanılan dili belirler. Aşağıdaki tercih edilen ses ve altyazı dillerinden ayrıdır; onlar videodaki parçaları seçer.",

  'set.frost.label': 'Buzlu cam saydamlığı',
  'set.frost.desc':
    'Panellerin ve kontrollerin buzlu cam görünümünün saydamlığını ayarlar. Yüksek değerler daha şeffaf, düşük değerler daha opak görünür.',

  // Multi-line descriptions carry their own \n breaks; the renderer splits on them
  // so each language wraps where it reads best, rather than at a fixed English break.

  'set.scanFolder.label': 'Klasörü oynatma listesine tara',
  'set.scanFolder.desc': 'Bir dosya açtığınızda aynı klasördeki diğer videoları da sıraya ekler.',
  'set.resume.label': 'Oynatmaya kaldığın yerden devam et',
  'set.resume.desc': 'Her dosyadaki oynatma konumunu hatırlar ve dosya yeniden açıldığında aynı konuma döner.',
  'set.resumePlaylist.label': 'Oynatma listesine kaldığın yerden devam et',
  'set.resumePlaylist.desc': 'Bir oynatma listesi dosyası veya bağlantısı yeniden açıldığında listedeki son izlenen videoya döner.',

  'set.keepPitch.label': 'Hız değişirken ses perdesini koru',
  'set.keepPitch.desc':
    'Yüksek oynatma hızlarında seslerin doğal perdesini korumak için ses zamanını esnetir.',
  'set.passthrough.label': 'Sesi doğrudan aktar',
  'set.passthrough.desc':
    'Sıkıştırılmış sesi bit akışı olarak harici bir alıcıya veya DAC aygıtına gönderir; kod çözmeyi Lunoir yerine bu aygıt yapar.\nBiçimi destekleyen donanım gerekir. Desteklenmeyen biçimlerde ses duyulmaz.',
  'set.audioLang.label': 'Tercih edilen ses dili',
  'set.subLang.label': 'Tercih edilen altyazı dili',
  // Audio and subtitle share the same English wording but have separate keys so
  // the Chinese can say "audio track" vs "subtitle" in each.
  'set.audioLang.desc':
    "Dosya açıldığında bu dili otomatik olarak seçer.\nVarsayılan ayar, dosyanın kendi parça sıralamasını kullanır.",
  'set.subLang.desc':
    "Dosya açıldığında bu dili otomatik olarak seçer.\nVarsayılan ayar, dosyanın kendi parça sıralamasını kullanır.",
  'set.subsDefault.label': 'Altyazılar varsayılan olarak açık',
  'set.subCodepage.label': 'Altyazı kodlaması',
  'set.subCodepage.desc':
    'Harici metin altyazıları içindir; UTF-8 her zaman önce tanınır.\nYüklenmiş altyazılardaki değişiklikleri uygulamak için videoyu yeniden açın.',
  'set.autoLoadSubs.label': 'Harici altyazıları otomatik yükle',
  'set.autoLoadSubs.desc': 'Videoyla aynı klasörde bulunan eşleşen .srt ve .ass dosyalarını yükler.',
  'set.hdrSubPeak.label': 'HDR altyazı parlaklığı',
  'set.hdrSubPeak.desc':
    'HDR video üzerindeki metin altyazıları (SRT/ASS) için nit cinsinden en yüksek parlaklık değeri. Düşük değerler daha soluk görünür.\nmpv, Blu-ray disklerde kullanılan PGS gibi görüntü altyazılarını desteklemez. SDR oynatma etkilenmez.',

  'set.subFont.label': 'Yazı tipi',
  'set.subFont.desc':
    'Kendi biçimlendirmesi olmayan metin altyazılarına (SRT/ASS) uygulanır. Altyazı dilinizdeki tüm karakterleri destekleyen bir yazı tipi seçin; eksik karakterler cümle ortasında başka bir yazı tipiyle gösterilir.',
  'set.subSize.label': 'Yazı tipi boyutu',
  'set.subSpacing.label': 'Harf aralığı',
  'set.subSpacing.desc': 'Karakterler arasındaki ek boşluk.',
  'set.subOutline.label': 'Dış çizgi',
  'set.subOutline.desc':
    'Altyazıların parlak sahnelerde okunabilir kalmasını sağlayan koyu kenarlığın kalınlığı.',
  'set.subBold.label': 'Kalın',
  'set.subMargin.label': 'Alt kenardan uzaklık',
  'set.subMargin.desc':
    'Varsayılan altyazı konumudur. Sağ paneldeki Altyazı konumu ayarı, bu değeri değiştirmeden mevcut videonun altyazılarını kaydırır.',

  'set.hwdec.label': 'Donanım kod çözme',
  'set.hwdec.auto': 'GPU ile kod çözme. En verimli seçenektir ve neredeyse her zaman doğru tercihtir.',
  'set.hwdec.autoCopy':
    'Kod çözme yine GPU üzerinde yapılır ancak her kare sistem belleğine kopyalanır. Görüntü bozuk, yırtılmış, bloklu veya anormal renklere sahipken ve kod çözme çalışmaya devam ediyorken denemeye değer.',
  'set.hwdec.off':
    'CPU ile kod çözme yapar. En uyumlu seçenektir ve son çare olarak denenmelidir; 4K videolarda işlemciye ciddi yük bindirir.',
  'set.deint.label': 'Geçmeli taramayı kaldırma',
  'set.deint.desc':
    'Yayın videolarında (1080i, 576i — çoğu canlı TV yayını, DVD ve TV kaydı) her kare, saniyenin çok küçük bir bölümü arayla yakalanmış, yarım yükseklikte iki alandan oluşur. Modern ekranlarda bu alanlar, hareketli kenarlarda tarak dişlerine benzeyen çizgiler oluşturabilir.\nOtomatik mod yalnızca kaynak görüntünün geçmeli taramalı olduğunu belirtiyorsa devreye girer; aşamalı taramalı video değiştirilmeden kalır. Bir kanal yanlış etiketlenmişse bu özelliği zorla açın.',
  'set.quality.label': 'Çevrim içi video kalitesi',
  'set.quality.desc':
    'Üst kalite sınırını belirler. Gerçek kalite yine kaynağa bağlıdır: 1080p ile sınırlandırılmış bir video, bu ayardan bağımsız olarak 1080p oynatılır. En iyi seçeneği, kaynağın sunduğu en yüksek kaliteyi kullanır. Bir sonraki yayın için geçerlidir.',
  'set.cookies.label': 'Tarayıcı çerezlerini kullan',
  'set.cookies.desc':
    'Üyelik gerektiren, yaş kısıtlamalı ve Premium videoların oynatılabilmesi için oturum açtığınız tarayıcının çerezlerini okur. Varsayılan olarak kapalıdır.',
  'set.cookiesFrom.label': 'Çerez kaynağı',

  'set.shotSubs.label': 'Altyazıları dahil et',
  'set.shotSubs.desc': 'Ekrandaki altyazıları kaydedilen görüntüye dahil eder.',
  'set.shotFormat.label': 'Biçim',
  'set.shotFormat.desc':
    'PNG kayıpsızdır. JPG, kalite 95 ayarında çok daha küçük dosyalar üretir ve kalite kaybı neredeyse fark edilmez.',
  'set.shotDir.label': 'Kayıt klasörü',
  'set.shotDir.desc': 'Ekran görüntülerinin kaydedileceği konum. Bir yol girin veya göz atarak seçin.',
  'set.shotDir.browse': 'Göz at…',
  'set.recDir.label': 'Kayıt klasörü',
  'set.recDir.desc': 'Canlı yayın kayıtlarının kaydedileceği konum. Bir yol girin veya göz atarak seçin.',

  'set.oscStyle.label': 'Kontrol stili',
  'set.oscStyle.desc1':
    'Yüzen: görüntünün üzerinde görünen, kısa bir süre işlem yapılmadığında gizlenen kompakt bir çubuk.',
  'set.oscStyle.desc2':
    'Sabit: pencerenin alt kısmında tam genişlikte görünür. Pencere modunda video bu kontrole yer açar; böylece kontrol görüntünün üzerini kapatmaz ve gizlenmez.',

  'set.oscDelay.label': 'Otomatik gizleme gecikmesi',
  'set.oscDelay.desc1':
    'İşaretçi hareket etmeyi bıraktıktan sonra ekrandaki kontrollerin ne kadar süre görünür kalacağını belirler.',
  'set.oscDelay.desc2': 'Varsayılan süre 5 saniyedir.',

  'set.seekPreview.label': 'Arama çubuğu küçük resimleri',
  'set.seekPreview.desc':
    'Arama çubuğunun üzerinde beklediğinizde ilgili anın önizlemesini gösterir. Yalnızca yerel dosyalarda çalışır.',

  'set.rememberWindow.label': 'Boyutu ve konumu hatırla',
  'set.rememberVolume.label': 'Ses düzeyini hatırla',

  'set.update.label': 'Sürüm',
  'set.update.check': 'Güncellemeleri denetle',
  'set.ytdl.label': 'Çevrim içi video desteği',
  'set.ytdl.desc':
    'Çevrim içi videolar yt-dlp ile çözümlenir. Lunoir bu bileşeni birkaç haftada bir otomatik olarak günceller.\nBir site oynatmayı durdurursa elle güncelleyin; siteler sık değişir ve bunun yaygın nedeni eski bir yt-dlp sürümüdür.',
  'set.ytdl.update': 'Şimdi güncelle',
  'set.ytdl.working': 'İndiriliyor…',
  'set.ytdl.done': 'En son sürüme güncellendi',
  'set.ytdl.failed': 'Güncellenemedi — bağlantınızı kontrol edin',
  'main.ytdlUpdated': 'Çevrim içi video desteği güncellendi — yeniden deneyin',
  'set.autoUpdate.label': 'Başlangıçta denetle',
  'set.autoUpdate.desc': 'Lunoir başlatıldığında yeni bir sürüm olup olmadığını sessizce denetler.',

  'set.timeline.label': 'Zaman çizelgesi',
  'set.timeline.desc':
    'Oynatma listesindeki yerel dosyaları tek bir zaman çizelgesi ve arama çubuğu olan kesintisiz bir videoda birleştirir. Böylece bir klasördeki klipleri baştan sona izleyebilirsiniz.\nFarklı biçimlerdeki kliplerin birleştiği noktalarda oynatma kısa süreli takılabilir. Etkinleştirildiğinde oynatma listesi panelinde bir açma/kapatma seçeneği görünür.',
  'set.pinOscTrim.label': 'Kırpma sırasında kontrolleri görünür tut',
  'set.pinOscTrim.desc':
    'Bir klibin başlangıç ve bitiş noktalarını ayarlarken ekrandaki kontrollerin otomatik gizlenmesini engeller; böylece tutamaçlara erişebilirsiniz.',

  // ---- updates (Home button + About section) ----
  'update.newVersion': 'Yeni sürüm mevcut',
  'update.clickToDownload': 'İndirmek için tıklayın',
  'update.current': 'Geçerli sürüm {version}',
  'update.checking': 'Denetleniyor…',
  'update.latest': 'En güncel sürümü kullanıyorsunuz',
  'update.found': 'Yeni sürüm {version} mevcut',
  'update.checkFailed': 'Denetlenemedi — daha sonra yeniden deneyin',
  'update.download': 'İndir',

  // option lists (format, codec and browser names are never translated)
  'opt.hwdec.auto': 'Otomatik',
  'opt.hwdec.autoCopy': 'Otomatik (geri kopyala)',
  'opt.hwdec.off': 'Kapalı (yazılımsal)',
  'opt.deint.auto': 'Otomatik (kaynak geçmeli taramalıysa)',
  'opt.deint.on': 'Her zaman açık',
  'opt.deint.off': 'Kapalı',
  'opt.quality.best': 'En iyi',
  'opt.oscStyle.floating': 'Yüzen',
  'opt.oscStyle.docked': 'Sabit',
  'opt.shot.png': 'PNG (kayıpsız)',
  'opt.shot.jpg': 'JPG (yüksek kalite)',
  'opt.subCodepage.auto': 'Otomatik algıla',
  'opt.subFont.system': 'Sistem varsayılanı (sans-serif)',
  'opt.lang.english': 'İngilizce',
  'opt.lang.chinese': 'Çince',
  'opt.lang.japanese': 'Japonca',
  'opt.lang.korean': 'Korece',
  'opt.lang.french': 'Fransızca',
  'opt.lang.german': 'Almanca',
  'opt.lang.spanish': 'İspanyolca',
  'opt.lang.italian': 'İtalyanca',
  'opt.lang.russian': 'Rusça',
  'opt.lang.portuguese': 'Portekizce',
  'opt.lang.turkish': 'Türkçe',
  'opt.uiLang.system': 'Sistem',
  'opt.clipFps.original': 'Özgün kare hızı',

  // ---- right panel: tabs ----
  'panel.tab.audioSub': 'Ses ve altyazı',
  'panel.tab.playlist': 'Oynatma listesi',
  'panel.tab.channels': 'Kanallar',
  'panel.tab.chapters': 'Bölümler',
  'panel.tab.clips': 'Klipler',
  'panel.empty.queue': 'Sırada öğe yok',
  'panel.repeat.off': 'Tekrar: kapalı',
  'panel.repeat.all': 'Tekrar: tümü',
  'panel.repeat.one': 'Tekrar: bir',
  'panel.shuffle.on': 'Karıştır: açık',
  'panel.shuffle.off': 'Karıştır: kapalı',
  'panel.merge.on': 'Zaman çizelgesi: açık',
  'panel.merge.off': 'Zaman çizelgesi: kapalı',
  'panel.addFiles': 'Dosya ekle',
  'panel.savePlaylist': 'Oynatma listesini kaydet',
  'panel.saveSource': 'Bu kaynağı kaydet',
  'panel.searchChannels': 'Kanallarda ara',
  'panel.ungrouped': 'Gruplanmamış',
  'panel.noMatches': 'Eşleşen kanal yok',
  'panel.removeCurrent': 'Geçerli öğeyi kaldır',

  // ---- "watch as one" (merged timeline) ----
  'timeline.title': 'Zaman çizelgesi',
  'timeline.resetRange': 'Aralığı sıfırla',

  // ---- right panel: chapters ----
  'panel.empty.chapters': 'Bölüm yok',
  'panel.chapterN': 'Bölüm {n}',

  // ---- right panel: tracks (audio & sub) ----
  'panel.sec.audio': 'Ses',
  'panel.sec.subtitles': 'Altyazılar',
  'panel.empty.audio': 'Ses parçası yok',
  'panel.subNone': 'Yok',
  'panel.addAudio': 'Ses ekle…',
  'panel.addSub': 'Altyazı ekle…',
  'panel.trackN': 'Parça {n}',

  // ---- right panel: subtitle/audio adjust ----
  'adjust.label': 'Ayarla',
  'adjust.active': 'Ayarlamalar etkin',
  'adjust.reset': 'Sıfırla',
  'adjust.delay': 'Gecikme',
  'adjust.position': 'Konum',
  'adjust.size': 'Boyut',
  'adjust.brightness': 'Parlaklık',
  'adjust.earlier': 'Daha erken (−0,1 sn)',
  'adjust.later': 'Daha geç (+0,1 sn)',
  'adjust.moveUp': 'Yukarı taşı',
  'adjust.moveDown': 'Aşağı taşı',
  'adjust.smaller': 'Küçült',
  'adjust.larger': 'Büyüt',
  'adjust.dimmer': 'Karart',
  'adjust.brighter': 'Parlat',
  'adjust.imageSubHint': 'Görüntü altyazısı — yalnızca konum ve gecikme',

  // ---- right-click menu ----
  'menu.previous': 'Önceki',
  'menu.next': 'Sonraki',
  'menu.prevChapter': 'Önceki bölüm',
  'menu.nextChapter': 'Sonraki bölüm',
  'menu.speed': 'Hız',
  'menu.speedNormal': 'Normal',
  'menu.aspect': 'En-boy oranı',
  'menu.aspectStretch': 'Ekranı dolduracak şekilde esnet',
  'menu.abStart': 'A-B döngüsü: başlangıcı ayarla (A)',
  'menu.abEnd': 'A-B döngüsü: bitişi ayarla (B)',
  'menu.abClear': 'A-B döngüsü: temizle',
  'menu.screenshot': 'Ekran görüntüsü',
  'menu.record': 'Kaydı başlat',
  'menu.stopRecord': 'Kaydı durdur',
  'menu.tcOverlay': 'Zaman kodu katmanı',
  'menu.favourite': 'Kitaplığa kaydet',
  'menu.hideTitleBar': 'Başlık çubuğunu gizle',
  'menu.mini': 'Mini oynatıcı',
  'mini.exit': 'Mini oynatıcıdan çık',
  'menu.home': 'Ana sayfaya dön',
  'menu.openFile': 'Dosya aç…',
  'menu.openUrl': 'URL aç…',
  'menu.fullscreen': 'Tam ekran',

  // ---- toasts (renderer) ----
  'toast.speedNormal': 'Normal hız',
  'toast.speed': 'Hız {v}×',
  'toast.screenshotSaved': 'Ekran görüntüsü Pictures › Lunoir konumuna kaydedildi',
  'toast.recordingSaved': 'Kayıt kaydedildi: {name}',
  'toast.favourited': 'Kitaplığa kaydedildi',
  'toast.alreadyFav': 'Zaten kitaplığınızda',
  'toast.unfavourited': 'Kitaplıktan kaldırıldı',
  'toast.loading': 'Yükleniyor…',

  // ---- toasts / dialogs (main process) ----
  'main.fetchingYtdl': 'yt-dlp alınıyor…',
  'main.ytdlFailed': "yt-dlp alınamadı",
  'main.loadingPlaylist': 'Oynatma listesi yükleniyor…',
  'main.playlistFailed': "Oynatma listesi yüklenemedi",
  'main.noMedia': 'Bu klasörde oynatılabilir medya yok',
  'main.skippedMissing': 'Bulunamayan bir dosya atlandı',
  'main.noPlayable': 'Dosya bulunamadı — lütfen dosyayı kontrol edin',
  'main.loadFailed': 'Bu oynatılamıyor — kaynak çevrim dışı olabilir',
  'main.folderTruncated': 'Klasörde {count} video var — ilk {max} tanesi yükleniyor',
  'main.resumed': '{time} konumundan devam edildi',
  'dlg.selectFolder': 'Bir klasör seçin (video klasörü veya Blu-ray/DVD diski)',
  'dlg.addAudio': 'Ses ekle',
  'dlg.addSubtitle': 'Altyazı ekle',
  'dlg.addToPlaylist': 'Oynatma listesine ekle',
  'dlg.openMedia': 'Medya aç',
  'dlg.chooseShotDir': 'Ekran görüntüsü klasörünü seç',
  'dlg.chooseRecDir': 'Kayıt klasörünü seç',
  'dlg.filter.subtitles': 'Altyazılar',
  'dlg.filter.media': 'Medya',
  'dlg.filter.allFiles': 'Tüm dosyalar',

  // ---- native app menu (hidden in the frameless window; reachable by shortcut) ----
  'appmenu.file': 'Dosya',
  'appmenu.open': 'Aç…',
  'appmenu.openFolder': 'Klasör aç…',
  'appmenu.view': 'Görünüm',

  // ---- file info overlay (i key) ----
  'info.title': 'Dosya bilgisi',
  'info.video': 'Video',
  'info.audio': 'Ses',
  'info.codec': 'Kodek',
  'info.resolution': 'Çözünürlük',
  'info.frameRate': 'Kare hızı',
  'info.bitRate': 'Video bit hızı',
  'info.overallBitRate': 'Toplam bit hızı',
  'info.fileSize': 'Dosya boyutu',
  'info.bitDepth': 'Renk bit derinliği',
  'info.colorSpace': 'Renk uzayı',
  'info.hdr': 'HDR',
  'info.container': 'Kapsayıcı',
  'info.duration': 'Süre',
  'info.noData': 'Medya bilgisi mevcut değil'
}

export type Key = keyof typeof tr
