// Français. Partial on purpose — any missing key falls back to English.
// Not translated: brand name (Lunoir), format/codec names (HDR10, Dolby Atmos,
// PGS, SubRip…), channel layouts, font family names.
import type { Key } from './en'

export const fr: Partial<Record<Key, string>> = {
  'win.minimize': 'Réduire',
  'win.maximize': 'Agrandir',
  'win.close': 'Fermer',

  'empty.tagline': 'Déposez une vidéo pour la lire',
  'empty.urlPlaceholder': 'Collez l’URL d’une vidéo ou d’un flux…',
  'empty.urlPlay': 'Lire',
  'empty.openFile': 'Ouvrir un fichier',
  'empty.hint': 'Double-clic pour un dossier · clic droit pour une URL',

  'osc.mute': 'Couper le son',
  'osc.unmute': 'Rétablir le son',
  'osc.play': 'Lecture',
  'osc.pause': 'Pause',
  'osc.back': 'Reculer de {n} s',
  'osc.forward': 'Avancer de {n} s',
  'osc.panel': 'Pistes et liste de lecture',
  'osc.timeFormat': 'Cliquer pour alterner : temps · timecode · image',

  'common.settings': 'Paramètres',
  'common.close': 'Fermer',
  'osc.library': 'Enregistrés et récents',
  'lib.favourites': 'Enregistrés',
  'lib.recent': 'Récents',
  'lib.emptyRecent': 'Rien de lu pour l’instant.',
  'lib.emptyFav': 'Rien d’enregistré. Faites un clic droit pendant la lecture pour l’enregistrer ici.',
  'lib.addFav': 'Enregistrer',
  'lib.remove': 'Retirer',
  'lib.playlists': 'Listes',
  'lib.live': 'En direct',
  'lib.emptyPlaylists': 'Aucune liste enregistrée. Enregistrez-en une depuis le panneau de lecture.',
  'lib.emptyLive': 'Aucune source en direct enregistrée.',
  'common.collapse': 'Réduire le panneau',
  'common.default': 'Par défaut',

  'set.sec.interface': 'Interface',
  'set.sec.playlist': 'Liste de lecture',
  'set.sec.audioSubs': 'Audio et sous-titres',
  'set.sec.subAppearance': 'Apparence des sous-titres',
  'set.sec.video': 'Vidéo',
  'set.sec.screenshots': 'Captures d’écran',
  'set.sec.controls': 'Commandes',
  'set.sec.window': 'Fenêtre',

  'set.uiLang.label': 'Langue de l’interface',
  'set.uiLang.desc':
    'La langue des menus et des paramètres de Lunoir. Distincte des langues audio et de sous-titres préférées ci-dessous, qui sélectionnent les pistes dans la vidéo.',

  'set.scanFolder.label': 'Analyser le dossier dans la liste',
  'set.scanFolder.desc':
    'À l’ouverture d’un fichier, ajouter aussi les autres vidéos de son dossier à la file.',
  'set.resume.label': 'Reprendre la lecture',
  'set.resume.desc':
    'Mémoriser la position dans chaque fichier et y revenir à sa réouverture.',
  'set.resumePlaylist.label': 'Reprendre les listes de lecture',
  'set.resumePlaylist.desc':
    'Rouvrir un lien de liste de lecture revient à la dernière vidéo regardée.',

  'set.keepPitch.label': 'Conserver la hauteur au changement de vitesse',
  'set.keepPitch.desc':
    'Étirer l’audio dans le temps pour que les voix gardent leur hauteur naturelle à vitesse élevée.',
  'set.passthrough.label': 'Passthrough audio',
  'set.passthrough.desc':
    'Envoyer l’audio compressé en bitstream vers un ampli ou un DAC externe, qui le décode à la place de Lunoir.\nNécessite un matériel compatible avec le format. Les formats non pris en charge resteront muets.',
  'set.audioLang.label': 'Langue audio préférée',
  'set.subLang.label': 'Langue des sous-titres préférée',
  'set.audioLang.desc':
    'Sélectionner automatiquement cette langue à l’ouverture d’un fichier.\nPar défaut, suit l’ordre des pistes du fichier.',
  'set.subLang.desc':
    'Sélectionner automatiquement cette langue à l’ouverture d’un fichier.\nPar défaut, suit l’ordre des pistes du fichier.',
  'set.subsDefault.label': 'Sous-titres activés par défaut',
  'set.autoLoadSubs.label': 'Charger les sous-titres externes',
  'set.autoLoadSubs.desc':
    'Charger les fichiers .srt et .ass correspondants placés à côté de la vidéo.',
  'set.hdrSubPeak.label': 'Luminosité des sous-titres HDR',
  'set.hdrSubPeak.desc':
    'Luminance de crête, en nits, des sous-titres texte (SRT/ASS) sur une vidéo HDR. Plus la valeur est basse, plus c’est sombre.\nLes sous-titres image (PGS, comme sur Blu-ray) ne sont pas pris en charge par mpv. La lecture SDR n’est pas affectée.',

  'set.subFont.label': 'Police',
  'set.subFont.desc':
    'S’applique aux sous-titres texte (SRT/ASS sans style propre). Choisissez une police couvrant entièrement votre langue de sous-titres ; les glyphes manquants basculent sur une autre police en milieu de phrase.',
  'set.subSize.label': 'Taille de police',
  'set.subSpacing.label': 'Espacement des lettres',
  'set.subSpacing.desc': 'Espace supplémentaire entre les caractères.',
  'set.subOutline.label': 'Contour',
  'set.subOutline.desc':
    'Épaisseur du bord sombre qui garde les sous-titres lisibles sur les scènes claires.',
  'set.subBold.label': 'Gras',
  'set.subMargin.label': 'Distance depuis le bas',
  'set.subMargin.desc':
    'Position de repos par défaut. Ajuster ▸ position des sous-titres dans le panneau de droite décale la vidéo en cours sans modifier cette valeur.',

  'set.hwdec.label': 'Décodage matériel',
  'set.hwdec.auto': 'Décodage GPU. Le plus efficace : les images restent en mémoire vidéo.',
  'set.hwdec.autoCopy':
    'Décodage GPU avec recopie des images en mémoire système. Requis par les filtres CPU comme SVP.',
  'set.hwdec.off': 'Décodage logiciel sur le CPU. Le plus compatible, mais plus exigeant.',
  'set.quality.label': 'Qualité des vidéos en ligne',
  'set.quality.desc':
    'Une limite maximale. La qualité réelle dépend de la source : une vidéo limitée à 1080p se lit en 1080p quel que soit ce réglage. « Meilleure » choisit la plus haute qualité proposée par la source. S’applique au prochain flux.',
  'set.cookies.label': 'Utiliser les cookies du navigateur',
  'set.cookies.desc':
    'Lit les cookies de votre navigateur connecté pour lire les vidéos réservées aux membres, aux abonnés Premium ou soumises à une limite d’âge. Désactivé par défaut.',
  'set.cookiesFrom.label': 'Cookies de',

  'set.shotSubs.label': 'Inclure les sous-titres',
  'set.shotSubs.desc': 'Inclure les sous-titres à l’écran dans l’image enregistrée.',
  'set.shotFormat.label': 'Format',
  'set.shotFormat.desc':
    'PNG est sans perte. JPG produit des fichiers bien plus légers en qualité 95, où la perte est quasi invisible.',
  'set.shotDir.label': 'Dossier d’enregistrement',
  'set.shotDir.desc':
    'Emplacement des captures d’écran. Saisissez un chemin ou parcourez.',
  'set.shotDir.browse': 'Parcourir…',

  'set.oscDelay.label': 'Délai de masquage automatique',
  'set.oscDelay.desc1':
    'Durée d’affichage des commandes à l’écran après l’arrêt du pointeur.',
  'set.oscDelay.desc2': 'Par défaut : 5 secondes.',

  'set.rememberWindow.label': 'Mémoriser taille et position',
  'set.rememberVolume.label': 'Mémoriser le volume',

  'opt.hwdec.auto': 'Auto',
  'opt.hwdec.autoCopy': 'Auto (recopie)',
  'opt.hwdec.off': 'Désactivé (logiciel)',
  'opt.quality.best': 'Meilleure',
  'opt.shot.png': 'PNG (sans perte)',
  'opt.shot.jpg': 'JPG (haute qualité)',
  'opt.subFont.system': 'Police système (sans-serif)',
  'opt.lang.english': 'Anglais',
  'opt.lang.chinese': 'Chinois',
  'opt.lang.japanese': 'Japonais',
  'opt.lang.korean': 'Coréen',
  'opt.lang.french': 'Français',
  'opt.lang.german': 'Allemand',
  'opt.lang.spanish': 'Espagnol',
  'opt.lang.italian': 'Italien',
  'opt.lang.russian': 'Russe',
  'opt.lang.portuguese': 'Portugais',
  'opt.uiLang.system': 'Système',

  'panel.tab.audioSub': 'Audio et ST',
  'panel.tab.playlist': 'Liste',
  'panel.tab.channels': 'Chaînes',
  'panel.tab.chapters': 'Chapitres',

  'panel.empty.queue': 'File vide',
  'panel.repeat.off': 'Répétition : off',
  'panel.repeat.all': 'Répétition : tout',
  'panel.repeat.one': 'Répétition : une',
  'panel.shuffle.on': 'Aléatoire : on',
  'panel.shuffle.off': 'Aléatoire : off',
  'panel.addFiles': 'Ajouter des fichiers',
  'panel.removeCurrent': 'Retirer l’actuel',

  'panel.empty.chapters': 'Aucun chapitre',
  'panel.chapterN': 'Chapitre {n}',

  'panel.sec.audio': 'Audio',
  'panel.sec.subtitles': 'Sous-titres',
  'panel.empty.audio': 'Aucune piste audio',
  'panel.subNone': 'Aucun',
  'panel.addSub': 'Ajouter un sous-titre…',
  'panel.trackN': 'Piste {n}',

  'adjust.label': 'Ajuster',
  'adjust.active': 'Ajustements actifs',
  'adjust.reset': 'Réinitialiser',
  'adjust.delay': 'Décalage',
  'adjust.position': 'Position',
  'adjust.size': 'Taille',
  'adjust.brightness': 'Luminosité',
  'adjust.earlier': 'Plus tôt (−0,1 s)',
  'adjust.later': 'Plus tard (+0,1 s)',
  'adjust.moveUp': 'Monter',
  'adjust.moveDown': 'Descendre',
  'adjust.smaller': 'Réduire',
  'adjust.larger': 'Agrandir',
  'adjust.dimmer': 'Assombrir',
  'adjust.brighter': 'Éclaircir',
  'adjust.imageSubHint': 'Sous-titre image — position et décalage uniquement',

  'menu.previous': 'Précédent',
  'menu.next': 'Suivant',
  'menu.prevChapter': 'Chapitre précédent',
  'menu.nextChapter': 'Chapitre suivant',
  'menu.speed': 'Vitesse',
  'menu.speedNormal': 'Normale',
  'menu.aspect': 'Format d’image',
  'menu.aspectStretch': 'Étirer pour remplir',
  'menu.abStart': 'Boucle A-B : début (A)',
  'menu.abEnd': 'Boucle A-B : fin (B)',
  'menu.abClear': 'Boucle A-B : effacer',
  'menu.screenshot': 'Capture d’écran',
  'menu.tcOverlay': 'Timecode en incrustation',
  'menu.favourite': 'Ajouter à la bibliothèque',
  'menu.openFile': 'Ouvrir un fichier…',
  'menu.openUrl': 'Ouvrir une URL…',
  'menu.fullscreen': 'Plein écran',

  'toast.speedNormal': 'Vitesse normale',
  'toast.speed': 'Vitesse {v}×',
  'toast.screenshotSaved': 'Capture enregistrée dans Images › Lunoir',
  'toast.loading': 'Chargement…',

  'main.fetchingYtdl': 'Récupération de yt-dlp…',
  'main.ytdlFailed': 'Échec de la récupération de yt-dlp',
  'main.loadingPlaylist': 'Chargement de la liste de lecture…',
  'main.playlistFailed': 'Échec du chargement de la liste',
  'main.noMedia': 'Aucun média lisible dans ce dossier',
  'main.folderTruncated':
    'Le dossier contient {count} vidéos — chargement des {max} premières',
  'main.resumed': 'Repris à {time}',
  'dlg.selectFolder': 'Sélectionner un dossier (dossier vidéo, ou disque Blu-ray/DVD)',
  'dlg.addSubtitle': 'Ajouter un sous-titre',
  'dlg.addToPlaylist': 'Ajouter à la liste de lecture',
  'dlg.openMedia': 'Ouvrir un média',
  'dlg.chooseShotDir': 'Choisir le dossier des captures',
  'dlg.filter.subtitles': 'Sous-titres',
  'dlg.filter.media': 'Médias',
  'dlg.filter.allFiles': 'Tous les fichiers',

  'appmenu.file': 'Fichier',
  'appmenu.open': 'Ouvrir…',
  'appmenu.openFolder': 'Ouvrir un dossier…',
  'appmenu.view': 'Affichage',

  'common.restoreDefault': 'Restaurer les valeurs par défaut',
  'set.sec.appearance': 'Apparence',
  'set.frost.label': 'Transparence du verre dépoli',
  'set.frost.desc':
    'Dans quelle mesure les panneaux et les commandes laissent voir la vidéo à travers leur verre dépoli. Plus haut = plus transparent ; plus bas = plus opaque.',

  'menu.record': 'Démarrer l’enregistrement',
  'menu.stopRecord': 'Arrêter l’enregistrement',
  'toast.recordingSaved': 'Enregistrement enregistré : {name}',
  'toast.favourited': 'Ajouté à la bibliothèque',
  'toast.unfavourited': 'Retiré de la bibliothèque',
  'dlg.chooseRecDir': 'Choisir le dossier d’enregistrement',
  'set.recDir.label': 'Dossier d’enregistrement',
  'set.recDir.desc':
    'Où les enregistrements en direct sont enregistrés. Saisissez un chemin ou parcourez.'
}
