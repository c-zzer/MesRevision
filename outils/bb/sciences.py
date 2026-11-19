from commun import fiche

S = [
fiche("svt", 1, "ADN, chromosomes et gènes", 2,
 "Chaque cellule contient dans son noyau des chromosomes faits d'ADN. Un gène est une portion d'ADN qui détermine un caractère. Un gène peut exister sous plusieurs versions : les allèles. L'être humain a 23 paires de chromosomes.",
 [("Du caractère à l'ADN", [
   "[def] Un **caractère** est un trait d'un individu (couleur des yeux, groupe sanguin…). Il dépend des **gènes** et parfois de l'**environnement** (bronzage, musculature).",
   "Dans le **noyau** de chaque cellule se trouvent les **chromosomes**, formés d'une longue molécule d'**ADN** enroulée.",
   "[def] Un **gène** est une ==portion d'ADN qui code un caractère==. Il occupe toujours la même place sur un chromosome donné."]),
  ("Le caryotype humain", [
   "[def] Le **caryotype** est la photographie des chromosomes rangés par paires.",
   "L'être humain a ==46 chromosomes, soit 23 paires==. La 23e paire est celle des **chromosomes sexuels** : XX chez la femme, XY chez l'homme.",
   "[att] Un caryotype anormal (ex. trois chromosomes 21 : trisomie 21) entraîne des différences dans l'organisme."]),
  ("Les allèles", [
   "[def] Les **allèles** sont les ==différentes versions d'un même gène== (ex. allèles A, B ou O du gène du groupe sanguin).",
   "Chaque individu possède 2 allèles pour chaque gène (un sur chaque chromosome de la paire), l'un venant du père, l'autre de la mère.",
   "Un allèle **dominant** s'exprime même en un seul exemplaire ; un allèle **récessif** ne s'exprime que s'il est présent en double."])],
 [("Où se trouvent les chromosomes ?", ["Dans le sang seulement", "Dans le noyau des cellules", "Dans les os", "Dans le cerveau seulement"], 1, "Les chromosomes sont dans le noyau de chaque cellule."),
  ("Combien de chromosomes a une cellule humaine ?", ["23", "46", "92", "12"], 1, "46 chromosomes, soit 23 paires."),
  ("Qu'est-ce qu'un gène ?", ["Une cellule", "Une portion d'ADN qui code un caractère", "Un organe", "Une maladie"], 1, "Le gène est un morceau d'ADN."),
  ("Qu'est-ce qu'un allèle ?", ["Une version d'un gène", "Un chromosome entier", "Un type de cellule", "Une protéine du sang"], 0, "Un gène peut avoir plusieurs versions : les allèles."),
  ("Les chromosomes sexuels d'un homme sont…", ["XX", "XY", "YY", "X"], 1, "XY chez l'homme, XX chez la femme.")]),

fiche("svt", 2, "La division cellulaire : la mitose", 2,
 "La mitose permet à une cellule de se diviser en deux cellules filles identiques entre elles et à la cellule mère. Avant la mitose, chaque chromosome est copié (réplication de l'ADN). C'est grâce à la mitose que l'organisme grandit et se répare.",
 [("Pourquoi les cellules se divisent", [
   "Un être humain commence par **une seule cellule** (la cellule-œuf) et finit avec des milliers de milliards. Les cellules se divisent pour ==la croissance et le renouvellement== (peau, cicatrisation)."]),
  ("Les étapes", [
   "1) **Réplication** : avant la division, chaque chromosome est ==dupliqué== ; il est alors formé de deux chromatides identiques.\n2) **Mitose** : les chromosomes se condensent, s'alignent au centre, puis les deux copies se séparent vers chaque pôle.\n3) Deux **cellules filles** se forment.",
   "[def] Les cellules filles ont ==le même nombre de chromosomes et la même information génétique== que la cellule mère (46 chez l'humain)."]),
  ("À retenir pour le brevet", [
   "[brevet] Si un document montre une cellule à 46 chromosomes qui donne deux cellules : chacune a 46 chromosomes, grâce à la copie préalable de l'ADN.",
   "[att] Ne confonds pas mitose (2 cellules identiques, 46 chromosomes) et méiose (cellules reproductrices, 23 chromosomes)."])],
 [("Combien de cellules filles donne une mitose ?", ["1", "2", "4", "46"], 1, "Une cellule mère donne deux cellules filles."),
  ("Les cellules filles issues d'une mitose sont…", ["différentes", "identiques à la cellule mère", "sans noyau", "avec 23 chromosomes"], 1, "Même nombre de chromosomes, même information génétique."),
  ("Que se passe-t-il avant la mitose ?", ["L'ADN est copié", "La cellule meurt", "Les chromosomes disparaissent", "La cellule perd son noyau"], 0, "La réplication double chaque chromosome."),
  ("À quoi sert la mitose ?", ["À produire les spermatozoïdes", "À la croissance et à la réparation des tissus", "À digérer", "À respirer"], 1, "Elle multiplie les cellules du corps."),
  ("Une cellule à 46 chromosomes fait une mitose : ses filles ont…", ["23 chromosomes", "46 chromosomes", "92 chromosomes", "12 chromosomes"], 1, "La mitose conserve le nombre de chromosomes.")]),

fiche("svt", 3, "Méiose, fécondation et diversité génétique", 3,
 "La méiose fabrique les cellules reproductrices (gamètes) avec 23 chromosomes, un de chaque paire, répartis au hasard. La fécondation réunit un spermatozoïde et un ovule : la cellule-œuf retrouve 46 chromosomes. Ces deux hasards rendent chaque individu unique.",
 [("La méiose", [
   "[def] La **méiose** est la division qui produit les **gamètes** (spermatozoïdes, ovules). Chaque gamète reçoit ==un seul chromosome de chaque paire== : 23 chromosomes.",
   "Le chromosome de chaque paire qui part dans un gamète est choisi **au hasard** : un même parent peut produire des millions de gamètes différents."]),
  ("La fécondation", [
   "[def] La **fécondation** est la rencontre d'un spermatozoïde (23 chromosomes) et d'un ovule (23 chromosomes). Elle forme une **cellule-œuf** à ==46 chromosomes==.",
   "La cellule-œuf se divise ensuite par mitoses pour former l'embryon."]),
  ("Pourquoi chaque individu est unique", [
   "- Hasard de la **méiose** (quel chromosome de chaque paire ?).\n- Hasard de la **fécondation** (quel spermatozoïde rencontre quel ovule ?).\n- Des **mutations** (modifications de l'ADN) peuvent créer de nouveaux allèles.",
   "[att] Seuls les vrais jumeaux (issus d'une même cellule-œuf) ont le même ADN."])],
 [("Combien de chromosomes a un spermatozoïde ?", ["46", "23", "92", "22"], 1, "Les gamètes ont 23 chromosomes."),
  ("Qu'est-ce que la fécondation ?", ["La division d'une cellule en deux", "La rencontre d'un spermatozoïde et d'un ovule", "La copie de l'ADN", "Une mutation"], 1, "Elle forme la cellule-œuf."),
  ("La cellule-œuf possède…", ["23 chromosomes", "46 chromosomes", "92 chromosomes", "aucun chromosome"], 1, "23 + 23 = 46."),
  ("Qu'est-ce qui rend chaque individu unique ?", ["Le hasard de la méiose et de la fécondation", "La mitose", "La nourriture seulement", "Rien, tous sont identiques"], 0, "Deux hasards brassent les allèles."),
  ("Qui possède le même ADN ?", ["Frère et sœur", "Les vrais jumeaux", "Parents et enfants", "Cousins"], 1, "Ils viennent de la même cellule-œuf.")]),

fiche("svt", 4, "Méthode : l'épreuve de sciences du brevet", 2,
 "L'épreuve de sciences dure 1 h et porte sur deux des trois disciplines : SVT, physique-chimie, technologie (30 min chacune). On y exploite des documents : il faut extraire des informations, les relier aux connaissances et rédiger des réponses précises.",
 [("Lire les documents", [
   "[meth] Pour un graphique : titre, axes et unités, puis décris l'évolution avec des **valeurs chiffrées**. Pour un tableau : compare les lignes ou colonnes utiles.",
   "[ex] « Entre 0 et 10 jours, le nombre de cellules passe de 1 000 à 8 000 : il augmente. »"]),
  ("Rédiger une réponse scientifique", [
   "- J'observe (je cite le document et ses valeurs).\n- Je sais (j'ajoute une connaissance du cours).\n- Je conclus (je réponds à la question).",
   "[astuce] Utilise le ==vocabulaire précis== : gène, allèle, chromosome, mitose, méiose, cellule-œuf."])],
 [("Combien dure l'épreuve de sciences ?", ["30 min", "1 h", "2 h", "3 h"], 1, "1 h pour deux disciplines."),
  ("Combien de disciplines tombent à l'épreuve de sciences ?", ["1", "2", "3", "4"], 1, "Deux parmi SVT, physique-chimie et technologie."),
  ("Que faut-il faire en premier face à un graphique ?", ["Le recopier", "Lire le titre, les axes et les unités", "Donner son avis", "Ignorer les valeurs"], 1, "On comprend d'abord ce qui est représenté."),
  ("Une bonne réponse scientifique contient…", ["seulement une opinion", "des valeurs du document et une connaissance du cours", "une seule phrase sans preuve", "un dessin"], 1, "J'observe, je sais, je conclus.")]),
]

T = [
fiche("techno", 1, "Le besoin et le cahier des charges", 2,
 "Un objet technique répond à un besoin. Le cahier des charges décrit ce que l'objet doit faire (fonctions) et les contraintes à respecter, avec des critères mesurables. On le vérifie à la fin en testant l'objet.",
 [("Besoin et fonction d'usage", [
   "[def] Le **besoin** est ce que l'utilisateur veut satisfaire. La **fonction d'usage** dit ==à quoi sert l'objet== (« un vélo sert à se déplacer »).",
   "L'**objet technique** est fabriqué par l'humain pour répondre à ce besoin."]),
  ("Le cahier des charges", [
   "[def] Document qui liste les **fonctions** (ce que l'objet doit faire) et les **contraintes** (ce qu'il doit respecter : prix, taille, sécurité, environnement…).",
   "Chaque exigence a un **critère** et un **niveau** mesurable. ==Exemple : autonomie (critère) ≥ 8 h (niveau).==",
   "[brevet] On peut te demander de vérifier si un objet respecte le cahier des charges à partir de mesures : compare chaque valeur au niveau demandé."]),
  ("Concevoir et choisir", [
   "Pour une même fonction, plusieurs **solutions techniques** existent. On les compare avec des critères (coût, poids, impact environnemental) avant de choisir.",
   "[astuce] Pense au **cycle de vie** : extraction des matières, fabrication, transport, utilisation, fin de vie (recyclage)."])],
 [("Qu'est-ce que la fonction d'usage ?", ["La couleur de l'objet", "Ce à quoi sert l'objet", "Son prix", "Son poids"], 1, "Elle répond à « à quoi ça sert ? »."),
  ("Que contient un cahier des charges ?", ["Les fonctions et contraintes avec des critères mesurables", "Seulement le prix", "Le mode d'emploi", "La publicité"], 0, "Fonctions, contraintes, critères et niveaux."),
  ("« Autonomie ≥ 8 h » : 8 h est…", ["le critère", "le niveau", "la fonction", "le besoin"], 1, "Le critère est l'autonomie, le niveau est 8 h."),
  ("Lequel est une contrainte ?", ["Se déplacer", "Coûter moins de 50 €", "Éclairer", "Communiquer"], 1, "Un prix maximal est une contrainte."),
  ("Quelle étape fait partie du cycle de vie ?", ["La fin de vie (recyclage)", "La publicité", "Le choix de la couleur", "Le nom de la marque"], 0, "Extraction, fabrication, transport, usage, fin de vie.")]),

fiche("techno", 2, "Chaîne d'information et chaîne d'énergie", 3,
 "Un système automatisé a une chaîne d'information (acquérir, traiter, communiquer) et une chaîne d'énergie (alimenter, distribuer, convertir, transmettre). Les capteurs acquièrent l'information ; les actionneurs agissent sur la matière.",
 [("La chaîne d'information", [
   "- **Acquérir** : un **capteur** détecte une grandeur (lumière, température, présence…).\n- **Traiter** : le programme (carte microcontrôleur) décide.\n- **Communiquer** : il envoie un ordre ou un message (écran, voyant, signal).",
   "[ex] Capteurs : bouton poussoir, capteur de luminosité, de température, détecteur de mouvement, capteur de distance (ultrasons)."]),
  ("La chaîne d'énergie", [
   "- **Alimenter** : pile, batterie, secteur, panneau solaire.\n- **Distribuer** : interrupteur, relais, carte de commande moteur.\n- **Convertir** : un **actionneur** transforme l'énergie (moteur : électrique → mécanique ; lampe : électrique → lumineuse).\n- **Transmettre** : engrenages, poulies, axes.",
   "[def] Un **actionneur** ==transforme l'énergie pour agir== (moteur, vérin, lampe, haut-parleur)."]),
  ("Exemple : un portail automatique", [
   "Un détecteur de présence (**capteur**) envoie l'information à la carte (**traiter**) qui commande le moteur (**actionneur**) via un relais (**distribuer**) ; le moteur ouvre le portail par des engrenages (**transmettre**)."])],
 [("Quelle fonction réalise un capteur ?", ["Acquérir une information", "Convertir l'énergie", "Transmettre un mouvement", "Alimenter"], 0, "Le capteur acquiert une grandeur physique."),
  ("Lequel est un actionneur ?", ["Un bouton poussoir", "Un moteur", "Un capteur de lumière", "Une carte microcontrôleur"], 1, "Le moteur convertit l'énergie électrique en mouvement."),
  ("Un moteur électrique convertit l'énergie…", ["lumineuse en électrique", "électrique en mécanique", "mécanique en chimique", "thermique en lumineuse"], 1, "Électrique → mécanique."),
  ("Quelle fonction de la chaîne d'énergie assure une batterie ?", ["Alimenter", "Traiter", "Acquérir", "Communiquer"], 0, "Elle fournit l'énergie."),
  ("Dans la chaîne d'information, qui « traite » ?", ["Le moteur", "Le programme dans la carte microcontrôleur", "La pile", "L'engrenage"], 1, "Le microcontrôleur exécute le programme.")]),

fiche("techno", 3, "Programmer : algorithmes, variables et conditions", 3,
 "Un algorithme est une suite d'instructions pour résoudre un problème. En programmation (Scratch, blocs), on utilise des variables, des boucles (répéter) et des conditions (si… alors… sinon). Un programme est souvent déclenché par un événement.",
 [("Les briques d'un programme", [
   "- **Événement** : ce qui lance le programme (« quand le drapeau est cliqué », appui sur un bouton).\n- **Variable** : une boîte qui contient une valeur qui peut changer (score, température).\n- **Boucle** : ==répéter== des instructions (répéter 10 fois, répéter indéfiniment, répéter jusqu'à…).\n- **Condition** : ==si… alors… sinon== selon un test."]),
  ("Lire un programme", [
   "[ex] « Répéter indéfiniment : si luminosité < 30 alors allumer la lampe, sinon éteindre la lampe. » → la lampe s'allume automatiquement quand il fait sombre.",
   "[meth] Pour trouver ce que fait un programme, déroule-le pas à pas en notant la valeur des variables."]),
  ("Les signaux", [
   "Un signal **logique** (tout ou rien) vaut 0 ou 1 (bouton appuyé ou non). Un signal **analogique** varie de façon continue (température). La carte le convertit en nombre (**numérique**)."])],
 [("Qu'est-ce qu'une variable ?", ["Un bloc qui répète", "Une boîte qui contient une valeur qui peut changer", "Un capteur", "Une erreur"], 1, "Elle stocke une valeur (score, mesure…)."),
  ("Quel bloc permet de répéter des instructions ?", ["Si… alors", "Une boucle « répéter »", "Une variable", "Un événement"], 1, "La boucle répète les instructions."),
  ("« Si luminosité < 30 alors allumer » est…", ["une boucle", "une condition", "une variable", "un capteur"], 1, "C'est un test : si… alors."),
  ("Un signal logique peut valoir…", ["0 ou 1", "n'importe quelle valeur", "seulement 100", "une couleur"], 0, "Tout ou rien : 0 ou 1."),
  ("Qu'est-ce qui déclenche souvent un programme ?", ["Un événement", "Une variable", "Une boucle", "Un commentaire"], 0, "Ex. : « quand le drapeau est cliqué ».")]),

fiche("techno", 4, "Les réseaux informatiques et Internet", 2,
 "Un réseau relie des appareils pour échanger des données. Chaque appareil a une adresse IP. Le switch relie les appareils d'un même réseau local ; le routeur relie des réseaux entre eux (box Internet). Sur Internet, un client demande et un serveur répond.",
 [("Le réseau local", [
   "[def] Un **réseau informatique** relie des appareils (ordinateurs, imprimantes, téléphones) pour ==partager des données==.",
   "- **Switch (commutateur)** : relie les appareils d'un même réseau local.\n- **Routeur** : relie des réseaux différents ; la box Internet en contient un.\n- Liaison **filaire** (câble Ethernet) ou **sans fil** (Wi-Fi)."]),
  ("Les adresses", [
   "[def] L'**adresse IP** identifie un appareil sur un réseau (ex. 192.168.1.12). Les appareils d'un même réseau local ont le ==même début d'adresse==.",
   "Le nom d'un site (www.exemple.fr) est traduit en adresse IP par un serveur **DNS**."]),
  ("Client et serveur, sécurité", [
   "Le **client** (ton navigateur) envoie une requête ; le **serveur** répond avec la page. Les données voyagent en **paquets** qui passent par des routeurs.",
   "[astuce] Sécurité : mot de passe long et unique, double authentification, site en **https** (cadenas)."])],
 [("Quel appareil relie des réseaux différents ?", ["Le switch", "Le routeur", "L'imprimante", "La souris"], 1, "Le routeur relie le réseau local à Internet."),
  ("À quoi sert une adresse IP ?", ["À identifier un appareil sur un réseau", "À recharger le téléphone", "À nommer un fichier", "À protéger l'écran"], 0, "Chaque appareil a son adresse IP."),
  ("Qui traduit un nom de site en adresse IP ?", ["Le switch", "Le serveur DNS", "Le clavier", "Le Wi-Fi"], 1, "Le DNS fait l'annuaire d'Internet."),
  ("Sur Internet, le navigateur est…", ["le serveur", "le client", "le routeur", "le câble"], 1, "Il envoie la requête : c'est le client."),
  ("Que garantit « https » ?", ["Une connexion chiffrée plus sûre", "Un site gratuit", "Un site plus rapide", "Un site sans publicité"], 0, "Le S signifie sécurisé : les échanges sont chiffrés.")]),
]
