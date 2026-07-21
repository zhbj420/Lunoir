// Español. Partial on purpose — any missing key falls back to English.
// Not translated: brand name (Lunoir), format/codec names, channel layouts,
// font family names.
import type { Key } from './en'

export const es: Partial<Record<Key, string>> = {
  'win.minimize': 'Minimizar',
  'win.maximize': 'Maximizar',
  'win.close': 'Cerrar',

  'empty.tagline': 'Arrastra un vídeo para reproducir',
  'empty.urlPlaceholder': 'Pega la URL de un vídeo o emisión…',
  'empty.urlPlay': 'Reproducir',
  'empty.openFile': 'Abrir archivo',
  'empty.hint': 'Doble clic para una carpeta · clic derecho para una URL',

  'osc.mute': 'Silenciar',
  'osc.unmute': 'Activar sonido',
  'osc.play': 'Reproducir',
  'osc.pause': 'Pausa',
  'osc.back': 'Retroceder {n} s',
  'osc.forward': 'Avanzar {n} s',
  'osc.panel': 'Pistas y lista',
  'osc.timeFormat': 'Clic para alternar: tiempo · timecode · fotograma',

  'common.settings': 'Ajustes',
  'common.close': 'Cerrar',
  'osc.library': 'Guardados y recientes',
  'lib.favourites': 'Guardados',
  'lib.recent': 'Recientes',
  'lib.emptyRecent': 'Aún no se ha reproducido nada.',
  'lib.emptyFav': 'Nada guardado todavía. Haz clic derecho durante la reproducción para guardarlo aquí.',
  'lib.addFav': 'Guardar',
  'lib.remove': 'Quitar',
  'lib.rename': 'Renombrar',
  'lib.back': 'Atrás',
  'lib.emptyList': 'Esta lista está vacía',
  'lib.playlists': 'Listas',
  'lib.live': 'En directo',
  'lib.emptyPlaylists': 'Aún no hay listas guardadas. Guarda una desde el panel de lista.',
  'lib.emptyLive': 'Aún no hay fuentes en directo guardadas.',
  'common.collapse': 'Contraer panel',
  'common.default': 'Predeterminado',

  'set.sec.interface': 'Interfaz',
  'set.sec.playlist': 'Lista de reproducción',
  'set.sec.audioSubs': 'Audio y subtítulos',
  'set.sec.subAppearance': 'Apariencia de subtítulos',
  'set.sec.video': 'Vídeo',
  'set.sec.screenshots': 'Capturas',
  'set.sec.controls': 'Controles',
  'set.sec.window': 'Ventana',

  'set.uiLang.label': 'Idioma de la interfaz',
  'set.uiLang.desc':
    'El idioma de los menús y ajustes de Lunoir. Distinto de los idiomas de audio y subtítulos preferidos de abajo, que seleccionan pistas dentro del vídeo.',

  'set.scanFolder.label': 'Escanear carpeta a la lista',
  'set.scanFolder.desc':
    'Al abrir un archivo, añadir también los demás vídeos de su carpeta a la cola.',
  'set.resume.label': 'Reanudar reproducción',
  'set.resume.desc':
    'Recordar la posición de cada archivo y volver a ella al reabrirlo.',
  'set.resumePlaylist.label': 'Reanudar listas de reproducción',
  'set.resumePlaylist.desc':
    'Reabrir un enlace de lista vuelve al último vídeo visto en ella.',

  'set.keepPitch.label': 'Mantener el tono al cambiar la velocidad',
  'set.keepPitch.desc':
    'Estirar el audio en el tiempo para que las voces conserven su tono natural a mayor velocidad.',
  'set.passthrough.label': 'Passthrough de audio',
  'set.passthrough.desc':
    'Enviar el audio comprimido como bitstream a un receptor o DAC externo, que lo decodifica en lugar de Lunoir.\nRequiere hardware compatible con el formato. Los formatos no compatibles no darán sonido.',
  'set.audioLang.label': 'Idioma de audio preferido',
  'set.subLang.label': 'Idioma de subtítulos preferido',
  'set.audioLang.desc':
    'Seleccionar este idioma automáticamente al abrir un archivo.\nPor defecto sigue el orden de pistas del archivo.',
  'set.subLang.desc':
    'Seleccionar este idioma automáticamente al abrir un archivo.\nPor defecto sigue el orden de pistas del archivo.',
  'set.subsDefault.label': 'Subtítulos activados por defecto',
  'set.autoLoadSubs.label': 'Cargar subtítulos externos',
  'set.autoLoadSubs.desc':
    'Cargar los archivos .srt y .ass coincidentes situados junto al vídeo.',
  'set.hdrSubPeak.label': 'Brillo de subtítulos HDR',
  'set.hdrSubPeak.desc':
    'Luminancia máxima, en nits, de los subtítulos de texto (SRT/ASS) sobre vídeo HDR. Valores más bajos son más tenues.\nLos subtítulos de imagen (PGS, como en Blu-ray) no son compatibles con mpv. La reproducción SDR no se ve afectada.',

  'set.subFont.label': 'Fuente',
  'set.subFont.desc':
    'Se aplica a los subtítulos de texto (SRT/ASS sin estilo propio). Elige una fuente que cubra por completo tu idioma de subtítulos; los glifos que falten cambian a otra fuente a mitad de frase.',
  'set.subSize.label': 'Tamaño de fuente',
  'set.subSpacing.label': 'Espaciado entre letras',
  'set.subSpacing.desc': 'Espacio adicional entre caracteres.',
  'set.subOutline.label': 'Contorno',
  'set.subOutline.desc':
    'Grosor del borde oscuro que mantiene legibles los subtítulos sobre escenas claras.',
  'set.subBold.label': 'Negrita',
  'set.subMargin.label': 'Distancia desde abajo',
  'set.subMargin.desc':
    'Posición de reposo predeterminada. «Ajustar ▸ posición de subtítulos» en el panel derecho desplaza el vídeo actual sin cambiar este valor.',

  'set.hwdec.label': 'Decodificación por hardware',
  'set.hwdec.auto': 'Decodificación por GPU. La más eficiente: los fotogramas quedan en memoria de vídeo.',
  'set.hwdec.autoCopy':
    'Decodificación por GPU con copia de vuelta a la memoria del sistema. La requieren filtros de CPU como SVP.',
  'set.hwdec.off': 'Decodificación por software en la CPU. La más compatible, pero más exigente.',
  'set.quality.label': 'Calidad de vídeo en línea',
  'set.quality.desc':
    'Un límite máximo. La calidad real depende de la fuente: un vídeo limitado a 1080p se reproduce en 1080p sin importar este ajuste. «Máxima» elige la mayor calidad que ofrezca la fuente. Se aplica a la próxima emisión.',
  'set.cookies.label': 'Usar cookies del navegador',
  'set.cookies.desc':
    'Lee las cookies de tu navegador con sesión iniciada para reproducir vídeos de miembros, con restricción de edad o Premium. Desactivado por defecto.',
  'set.cookiesFrom.label': 'Cookies de',

  'set.shotSubs.label': 'Incluir subtítulos',
  'set.shotSubs.desc': 'Incluir los subtítulos en pantalla en la imagen guardada.',
  'set.shotFormat.label': 'Formato',
  'set.shotFormat.desc':
    'PNG es sin pérdida. JPG genera archivos mucho más pequeños con calidad 95, donde la pérdida es casi invisible.',
  'set.shotDir.label': 'Carpeta de guardado',
  'set.shotDir.desc':
    'Dónde se guardan las capturas. Escribe una ruta o examina.',
  'set.shotDir.browse': 'Examinar…',

  'set.oscDelay.label': 'Retardo de ocultación automática',
  'set.oscDelay.desc1':
    'Cuánto permanecen visibles los controles en pantalla tras detenerse el puntero.',
  'set.oscDelay.desc2': 'Por defecto: 5 segundos.',

  'set.rememberWindow.label': 'Recordar tamaño y posición',
  'set.rememberVolume.label': 'Recordar el volumen',

  'opt.hwdec.auto': 'Auto',
  'opt.hwdec.autoCopy': 'Auto (copia de vuelta)',
  'opt.hwdec.off': 'Desactivado (software)',
  'opt.quality.best': 'Máxima',
  'opt.shot.png': 'PNG (sin pérdida)',
  'opt.shot.jpg': 'JPG (alta calidad)',
  'opt.subFont.system': 'Predeterminada del sistema (sans-serif)',
  'opt.lang.english': 'Inglés',
  'opt.lang.chinese': 'Chino',
  'opt.lang.japanese': 'Japonés',
  'opt.lang.korean': 'Coreano',
  'opt.lang.french': 'Francés',
  'opt.lang.german': 'Alemán',
  'opt.lang.spanish': 'Español',
  'opt.lang.italian': 'Italiano',
  'opt.lang.russian': 'Ruso',
  'opt.lang.portuguese': 'Portugués',
  'opt.uiLang.system': 'Sistema',

  'panel.tab.audioSub': 'Audio y sub.',
  'panel.tab.playlist': 'Lista',
  'panel.tab.channels': 'Canales',
  'panel.tab.chapters': 'Capítulos',

  'panel.empty.queue': 'Cola vacía',
  'panel.repeat.off': 'Repetir: no',
  'panel.repeat.all': 'Repetir: todo',
  'panel.repeat.one': 'Repetir: uno',
  'panel.shuffle.on': 'Aleatorio: sí',
  'panel.shuffle.off': 'Aleatorio: no',
  'panel.addFiles': 'Añadir archivos',
  'panel.savePlaylist': 'Guardar lista',
  'panel.saveSource': 'Guardar fuente',
  'panel.removeCurrent': 'Quitar el actual',

  'panel.empty.chapters': 'Sin capítulos',
  'panel.chapterN': 'Capítulo {n}',

  'panel.sec.audio': 'Audio',
  'panel.sec.subtitles': 'Subtítulos',
  'panel.empty.audio': 'Sin pistas de audio',
  'panel.subNone': 'Ninguno',
  'panel.addSub': 'Añadir subtítulo…',
  'panel.trackN': 'Pista {n}',

  'adjust.label': 'Ajustar',
  'adjust.active': 'Ajustes activos',
  'adjust.reset': 'Restablecer',
  'adjust.delay': 'Retardo',
  'adjust.position': 'Posición',
  'adjust.size': 'Tamaño',
  'adjust.brightness': 'Brillo',
  'adjust.earlier': 'Antes (−0,1 s)',
  'adjust.later': 'Después (+0,1 s)',
  'adjust.moveUp': 'Subir',
  'adjust.moveDown': 'Bajar',
  'adjust.smaller': 'Reducir',
  'adjust.larger': 'Aumentar',
  'adjust.dimmer': 'Atenuar',
  'adjust.brighter': 'Aclarar',
  'adjust.imageSubHint': 'Subtítulo de imagen — solo posición y retardo',

  'menu.previous': 'Anterior',
  'menu.next': 'Siguiente',
  'menu.prevChapter': 'Capítulo anterior',
  'menu.nextChapter': 'Capítulo siguiente',
  'menu.speed': 'Velocidad',
  'menu.speedNormal': 'Normal',
  'menu.aspect': 'Relación de aspecto',
  'menu.aspectStretch': 'Estirar para llenar',
  'menu.abStart': 'Bucle A-B: inicio (A)',
  'menu.abEnd': 'Bucle A-B: fin (B)',
  'menu.abClear': 'Bucle A-B: borrar',
  'menu.screenshot': 'Captura',
  'menu.tcOverlay': 'Timecode superpuesto',
  'menu.favourite': 'Añadir a la biblioteca',
  'menu.openFile': 'Abrir archivo…',
  'menu.openUrl': 'Abrir URL…',
  'menu.fullscreen': 'Pantalla completa',

  'toast.speedNormal': 'Velocidad normal',
  'toast.speed': 'Velocidad {v}×',
  'toast.screenshotSaved': 'Captura guardada en Imágenes › Lunoir',
  'toast.loading': 'Cargando…',

  'main.fetchingYtdl': 'Obteniendo yt-dlp…',
  'main.ytdlFailed': 'No se pudo obtener yt-dlp',
  'main.loadingPlaylist': 'Cargando lista de reproducción…',
  'main.playlistFailed': 'No se pudo cargar la lista',
  'main.noMedia': 'No hay medios reproducibles en esta carpeta',
  'main.skippedMissing': 'Se omitió un archivo ausente',
  'main.noPlayable': 'Archivo no encontrado; comprueba el archivo',
  'main.loadFailed': 'No se puede reproducir; la fuente puede estar fuera de línea',
  'main.folderTruncated':
    'La carpeta tiene {count} vídeos — cargando los primeros {max}',
  'main.resumed': 'Reanudado desde {time}',
  'dlg.selectFolder': 'Selecciona una carpeta (carpeta de vídeo o disco Blu-ray/DVD)',
  'dlg.addSubtitle': 'Añadir subtítulo',
  'dlg.addToPlaylist': 'Añadir a la lista de reproducción',
  'dlg.openMedia': 'Abrir medio',
  'dlg.chooseShotDir': 'Elegir carpeta de capturas',
  'dlg.filter.subtitles': 'Subtítulos',
  'dlg.filter.media': 'Medios',
  'dlg.filter.allFiles': 'Todos los archivos',

  'appmenu.file': 'Archivo',
  'appmenu.open': 'Abrir…',
  'appmenu.openFolder': 'Abrir carpeta…',
  'appmenu.view': 'Ver',

  'common.restoreDefault': 'Restaurar valores predeterminados',
  'set.sec.appearance': 'Apariencia',
  'set.frost.label': 'Transparencia del vidrio esmerilado',
  'set.frost.desc':
    'Cuánto dejan ver el vídeo los paneles y controles a través de su vidrio esmerilado. Más alto es más transparente; más bajo, más sólido.',

  'menu.record': 'Iniciar grabación',
  'menu.stopRecord': 'Detener grabación',
  'toast.recordingSaved': 'Grabación guardada: {name}',
  'toast.favourited': 'Añadido a la biblioteca',
  'toast.unfavourited': 'Quitado de la biblioteca',
  'dlg.chooseRecDir': 'Elegir carpeta de grabación',
  'set.recDir.label': 'Carpeta de grabación',
  'set.recDir.desc':
    'Dónde se guardan las grabaciones en directo. Escribe una ruta o examina.'
}
