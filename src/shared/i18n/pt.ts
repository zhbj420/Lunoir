// Português. Partial on purpose — any missing key falls back to English.
// Not translated: brand name (Lunoir), format/codec names, channel layouts,
// font family names.
import type { Key } from './en'

export const pt: Partial<Record<Key, string>> = {
  'win.minimize': 'Minimizar',
  'win.maximize': 'Maximizar',
  'win.close': 'Fechar',

  'empty.tagline': 'Arraste um vídeo para reproduzir',
  'empty.urlPlaceholder': 'Cole o URL de um vídeo ou transmissão…',
  'empty.urlPlay': 'Reproduzir',
  'empty.openFile': 'Abrir ficheiro',
  'empty.hint': 'Duplo clique para uma pasta · clique direito para um URL',

  'osc.mute': 'Silenciar',
  'osc.unmute': 'Ativar som',
  'osc.play': 'Reproduzir',
  'osc.pause': 'Pausa',
  'osc.back': 'Recuar {n} s',
  'osc.forward': 'Avançar {n} s',
  'osc.panel': 'Faixas e lista',
  'osc.timeFormat': 'Clique para alternar: tempo · timecode · fotograma',

  'common.settings': 'Definições',
  'common.collapse': 'Recolher painel',
  'common.default': 'Predefinido',

  'set.sec.interface': 'Interface',
  'set.sec.playlist': 'Lista de reprodução',
  'set.sec.audioSubs': 'Áudio e legendas',
  'set.sec.subAppearance': 'Aspeto das legendas',
  'set.sec.video': 'Vídeo',
  'set.sec.screenshots': 'Capturas de ecrã',
  'set.sec.controls': 'Controlos',
  'set.sec.window': 'Janela',

  'set.uiLang.label': 'Idioma da interface',
  'set.uiLang.desc':
    'O idioma dos menus e definições do Lunoir. Distinto dos idiomas de áudio e legendas preferidos abaixo, que selecionam faixas dentro do vídeo.',

  'set.scanFolder.label': 'Analisar pasta para a lista',
  'set.scanFolder.desc':
    'Ao abrir um ficheiro, adicionar também os outros vídeos da sua pasta à fila.',
  'set.resume.label': 'Retomar reprodução',
  'set.resume.desc':
    'Memorizar a posição de cada ficheiro e regressar a ela ao reabri-lo.',
  'set.resumePlaylist.label': 'Retomar listas de reprodução',
  'set.resumePlaylist.desc':
    'Reabrir um link de lista regressa ao último vídeo visto nela.',

  'set.keepPitch.label': 'Manter o tom ao mudar a velocidade',
  'set.keepPitch.desc':
    'Esticar o áudio no tempo para que as vozes mantenham o tom natural a velocidades mais altas.',
  'set.passthrough.label': 'Passthrough de áudio',
  'set.passthrough.desc':
    'Enviar o áudio comprimido como bitstream para um recetor ou DAC externo, que o descodifica em vez do Lunoir.\nRequer hardware compatível com o formato. Formatos não suportados ficam sem som.',
  'set.audioLang.label': 'Idioma de áudio preferido',
  'set.subLang.label': 'Idioma de legendas preferido',
  'set.audioLang.desc':
    'Selecionar este idioma automaticamente ao abrir um ficheiro.\nPor predefinição segue a ordem de faixas do ficheiro.',
  'set.subLang.desc':
    'Selecionar este idioma automaticamente ao abrir um ficheiro.\nPor predefinição segue a ordem de faixas do ficheiro.',
  'set.subsDefault.label': 'Legendas ativas por predefinição',
  'set.autoLoadSubs.label': 'Carregar legendas externas',
  'set.autoLoadSubs.desc':
    'Carregar os ficheiros .srt e .ass correspondentes junto ao vídeo.',
  'set.hdrSubPeak.label': 'Brilho das legendas HDR',
  'set.hdrSubPeak.desc':
    'Luminância de pico, em nits, das legendas de texto (SRT/ASS) sobre vídeo HDR. Valores mais baixos são mais escuros.\nLegendas de imagem (PGS, como em Blu-ray) não são suportadas pelo mpv. A reprodução SDR não é afetada.',

  'set.subFont.label': 'Tipo de letra',
  'set.subFont.desc':
    'Aplica-se a legendas de texto (SRT/ASS sem estilo próprio). Escolha um tipo de letra que cubra por completo o seu idioma de legendas; os glifos em falta mudam para outro tipo de letra a meio da frase.',
  'set.subSize.label': 'Tamanho da letra',
  'set.subSpacing.label': 'Espaçamento entre letras',
  'set.subSpacing.desc': 'Espaço adicional entre caracteres.',
  'set.subOutline.label': 'Contorno',
  'set.subOutline.desc':
    'Espessura do bordo escuro que mantém as legendas legíveis sobre cenas claras.',
  'set.subBold.label': 'Negrito',
  'set.subMargin.label': 'Distância ao fundo',
  'set.subMargin.desc':
    'Posição de repouso predefinida. «Ajustar ▸ posição das legendas» no painel direito desloca o vídeo atual sem alterar este valor.',

  'set.hwdec.label': 'Descodificação por hardware',
  'set.hwdec.auto': 'Descodificação por GPU. A mais eficiente: os fotogramas ficam na memória de vídeo.',
  'set.hwdec.autoCopy':
    'Descodificação por GPU com cópia de volta para a memória do sistema. Necessária para filtros de CPU como o SVP.',
  'set.hwdec.off': 'Descodificação por software na CPU. A mais compatível, mas mais exigente.',
  'set.quality.label': 'Qualidade de vídeo online',
  'set.quality.desc':
    'Um limite máximo. A qualidade real depende da fonte: um vídeo limitado a 1080p reproduz em 1080p independentemente desta definição. «Máxima» escolhe a maior qualidade oferecida pela fonte. Aplica-se à próxima transmissão.',
  'set.cookies.label': 'Usar cookies do navegador',
  'set.cookies.desc':
    'Lê os cookies do seu navegador com sessão iniciada para reproduzir vídeos de membros, com restrição de idade ou Premium. Desativado por predefinição.',
  'set.cookiesFrom.label': 'Cookies de',

  'set.shotSubs.label': 'Incluir legendas',
  'set.shotSubs.desc': 'Incluir as legendas no ecrã na imagem guardada.',
  'set.shotFormat.label': 'Formato',
  'set.shotFormat.desc':
    'PNG é sem perdas. JPG produz ficheiros muito mais pequenos com qualidade 95, onde a perda é quase invisível.',
  'set.shotDir.label': 'Pasta de gravação',
  'set.shotDir.desc':
    'Onde as capturas são guardadas. Escreva um caminho ou procure.',
  'set.shotDir.browse': 'Procurar…',

  'set.oscDelay.label': 'Atraso de ocultação automática',
  'set.oscDelay.desc1':
    'Durante quanto tempo os controlos no ecrã permanecem visíveis após o ponteiro parar.',
  'set.oscDelay.desc2': 'Predefinição: 5 segundos.',

  'set.rememberWindow.label': 'Memorizar tamanho e posição',
  'set.rememberVolume.label': 'Memorizar o volume',

  'opt.hwdec.auto': 'Auto',
  'opt.hwdec.autoCopy': 'Auto (cópia de volta)',
  'opt.hwdec.off': 'Desativado (software)',
  'opt.quality.best': 'Máxima',
  'opt.shot.png': 'PNG (sem perdas)',
  'opt.shot.jpg': 'JPG (alta qualidade)',
  'opt.subFont.system': 'Predefinição do sistema (sans-serif)',
  'opt.lang.english': 'Inglês',
  'opt.lang.chinese': 'Chinês',
  'opt.lang.japanese': 'Japonês',
  'opt.lang.korean': 'Coreano',
  'opt.lang.french': 'Francês',
  'opt.lang.german': 'Alemão',
  'opt.lang.spanish': 'Espanhol',
  'opt.lang.italian': 'Italiano',
  'opt.lang.russian': 'Russo',
  'opt.lang.portuguese': 'Português',
  'opt.uiLang.system': 'Sistema',

  'panel.tab.audioSub': 'Áudio e leg.',
  'panel.tab.playlist': 'Lista',
  'panel.tab.chapters': 'Capítulos',

  'panel.empty.queue': 'Fila vazia',
  'panel.repeat.off': 'Repetir: desl.',
  'panel.repeat.all': 'Repetir: tudo',
  'panel.repeat.one': 'Repetir: um',
  'panel.shuffle.on': 'Aleatório: lig.',
  'panel.shuffle.off': 'Aleatório: desl.',
  'panel.addFiles': 'Adicionar ficheiros',
  'panel.removeCurrent': 'Remover o atual',

  'panel.empty.chapters': 'Sem capítulos',
  'panel.chapterN': 'Capítulo {n}',

  'panel.sec.audio': 'Áudio',
  'panel.sec.subtitles': 'Legendas',
  'panel.empty.audio': 'Sem faixas de áudio',
  'panel.subNone': 'Nenhuma',
  'panel.addSub': 'Adicionar legenda…',
  'panel.trackN': 'Faixa {n}',

  'adjust.label': 'Ajustar',
  'adjust.active': 'Ajustes ativos',
  'adjust.reset': 'Repor',
  'adjust.delay': 'Atraso',
  'adjust.position': 'Posição',
  'adjust.size': 'Tamanho',
  'adjust.brightness': 'Brilho',
  'adjust.earlier': 'Mais cedo (−0,1 s)',
  'adjust.later': 'Mais tarde (+0,1 s)',
  'adjust.moveUp': 'Subir',
  'adjust.moveDown': 'Descer',
  'adjust.smaller': 'Reduzir',
  'adjust.larger': 'Aumentar',
  'adjust.dimmer': 'Escurecer',
  'adjust.brighter': 'Clarear',
  'adjust.imageSubHint': 'Legenda de imagem — apenas posição e atraso',

  'menu.previous': 'Anterior',
  'menu.next': 'Seguinte',
  'menu.prevChapter': 'Capítulo anterior',
  'menu.nextChapter': 'Capítulo seguinte',
  'menu.speed': 'Velocidade',
  'menu.speedNormal': 'Normal',
  'menu.aspect': 'Proporção',
  'menu.aspectStretch': 'Esticar para preencher',
  'menu.abStart': 'Ciclo A-B: início (A)',
  'menu.abEnd': 'Ciclo A-B: fim (B)',
  'menu.abClear': 'Ciclo A-B: limpar',
  'menu.screenshot': 'Captura de ecrã',
  'menu.tcOverlay': 'Timecode sobreposto',
  'menu.openFile': 'Abrir ficheiro…',
  'menu.openUrl': 'Abrir URL…',
  'menu.fullscreen': 'Ecrã inteiro',

  'toast.speedNormal': 'Velocidade normal',
  'toast.speed': 'Velocidade {v}×',
  'toast.screenshotSaved': 'Captura guardada em Imagens › Lunoir',
  'toast.loading': 'A carregar…',

  'main.fetchingYtdl': 'A obter yt-dlp…',
  'main.ytdlFailed': 'Não foi possível obter o yt-dlp',
  'main.loadingPlaylist': 'A carregar a lista de reprodução…',
  'main.playlistFailed': 'Não foi possível carregar a lista',
  'main.noMedia': 'Sem media reproduzível nesta pasta',
  'main.folderTruncated':
    'A pasta tem {count} vídeos — a carregar os primeiros {max}',
  'main.resumed': 'Retomado a partir de {time}',
  'dlg.selectFolder': 'Selecione uma pasta (pasta de vídeo ou disco Blu-ray/DVD)',
  'dlg.addSubtitle': 'Adicionar legenda',
  'dlg.addToPlaylist': 'Adicionar à lista de reprodução',
  'dlg.openMedia': 'Abrir media',
  'dlg.chooseShotDir': 'Escolher pasta de capturas',
  'dlg.filter.subtitles': 'Legendas',
  'dlg.filter.media': 'Media',
  'dlg.filter.allFiles': 'Todos os ficheiros',

  'appmenu.file': 'Ficheiro',
  'appmenu.open': 'Abrir…',
  'appmenu.openFolder': 'Abrir pasta…',
  'appmenu.view': 'Ver',

  'common.restoreDefault': 'Repor predefinições',
  'set.sec.appearance': 'Aparência',
  'set.frost.label': 'Transparência do vidro fosco',
  'set.frost.desc':
    'Quanto os painéis e controlos deixam ver o vídeo através do vidro fosco. Mais alto é mais transparente; mais baixo, mais sólido.',

  'menu.record': 'Iniciar gravação',
  'menu.stopRecord': 'Parar gravação',
  'toast.recordingSaved': 'Gravação guardada: {name}',
  'dlg.chooseRecDir': 'Escolher pasta de gravação',
  'set.recDir.label': 'Pasta de gravação',
  'set.recDir.desc':
    'Onde as gravações em direto são guardadas. Escreva um caminho ou procure.'
}
