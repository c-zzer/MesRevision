from commun import fiche

F = [
fiche("maths", 1, "Arithmétique : diviseurs et nombres premiers", 2,
 "Un nombre premier a exactement deux diviseurs : 1 et lui-même. Tout entier ≥ 2 se décompose de façon unique en produit de facteurs premiers. Cette décomposition sert à simplifier des fractions et à résoudre des problèmes de partage.",
 [("Diviseurs et multiples", [
   "[def] b est un **diviseur** de a si a = b × k avec k entier (le reste de la division euclidienne est 0). On dit aussi que a est un **multiple** de b.",
   "Critères : divisible par **2** si le chiffre des unités est pair ; par **5** s'il finit par 0 ou 5 ; par **3** (ou **9**) si la ==somme des chiffres== est divisible par 3 (ou 9).",
   "[ex] 126 : 1 + 2 + 6 = 9, donc 126 est divisible par 3 et par 9."]),
  ("Nombres premiers et décomposition", [
   "Nombres premiers < 30 : 2, 3, 5, 7, 11, 13, 17, 19, 23, 29.",
   "[att] 1 n'est pas premier (un seul diviseur). 2 est le seul nombre premier pair.",
   "[meth] On divise par 2, 3, 5, 7… tant que c'est possible. ==Exemple : 360 = 2 × 180 = 2 × 2 × 90 = … = 2³ × 3² × 5.=="]),
  ("Fraction irréductible et problème de partage", [
   "[ex] 84/126 : 84 = 2² × 3 × 7 et 126 = 2 × 3² × 7. Facteurs communs : 2 × 3 × 7 = 42. Donc 84/126 = 2/3.",
   "[brevet] « Un fleuriste a 84 roses et 126 tulipes. Il veut faire le plus grand nombre de bouquets identiques en utilisant toutes les fleurs. » → plus grand diviseur commun = 42 bouquets, chacun avec 2 roses et 3 tulipes."])],
 [("Lequel est un nombre premier ?", ["21", "27", "29", "33"], 2, "29 n'a que deux diviseurs : 1 et 29."),
  ("La décomposition de 60 est…", ["2 × 30", "2² × 3 × 5", "4 × 15", "2 × 3 × 10"], 1, "60 = 2 × 2 × 3 × 5, avec seulement des facteurs premiers."),
  ("126 est divisible par 9 car…", ["il est pair", "la somme de ses chiffres vaut 9", "il finit par 6", "il est plus grand que 9"], 1, "1 + 2 + 6 = 9."),
  ("La forme irréductible de 84/126 est…", ["42/63", "2/3", "4/6", "7/9"], 1, "On simplifie par 42."),
  ("1 est-il un nombre premier ?", ["Oui", "Non, il n'a qu'un seul diviseur", "Oui, c'est le plus petit", "Seulement en 3e"], 1, "Un nombre premier a exactement deux diviseurs distincts.")]),

fiche("maths", 2, "Calcul numérique : fractions et puissances", 2,
 "Pour additionner des fractions, on les met au même dénominateur ; pour multiplier, on multiplie numérateurs et dénominateurs ; diviser revient à multiplier par l'inverse. Puissances : aⁿ × aᵐ = aⁿ⁺ᵐ, (aⁿ)ᵐ = aⁿˣᵐ, 10⁻ⁿ = 1/10ⁿ.",
 [("Fractions", [
   "- **Addition / soustraction** : même dénominateur. 2/3 + 1/4 = 8/12 + 3/12 = 11/12.\n- **Multiplication** : 2/3 × 5/7 = 10/21.\n- **Division** : multiplier par l'inverse. 2/3 ÷ 4/5 = 2/3 × 5/4 = 10/12 = 5/6.",
   "[att] Priorités : multiplication et division avant addition et soustraction, et les parenthèses d'abord."]),
  ("Puissances", [
   "[def] aⁿ = a × a × … × a (n facteurs). a⁰ = 1 et a⁻ⁿ = 1/aⁿ.",
   "- aⁿ × aᵐ = ==aⁿ⁺ᵐ==\n- aⁿ / aᵐ = aⁿ⁻ᵐ\n- (aⁿ)ᵐ = aⁿˣᵐ",
   "[att] (−2)⁴ = 16 mais −2⁴ = −16 : la parenthèse change tout."]),
  ("Notation scientifique", [
   "[def] Écriture a × 10ⁿ avec ==1 ≤ a < 10==.",
   "[ex] 45 000 = 4,5 × 10⁴ ; 0,0032 = 3,2 × 10⁻³."])],
 [("2/3 + 1/4 = ?", ["3/7", "11/12", "3/12", "2/12"], 1, "8/12 + 3/12 = 11/12."),
  ("2/3 ÷ 4/5 = ?", ["8/15", "5/6", "6/5", "10/3"], 1, "2/3 × 5/4 = 10/12 = 5/6."),
  ("10³ × 10⁴ = ?", ["10¹²", "10⁷", "100⁷", "10¹"], 1, "On additionne les exposants : 3 + 4 = 7."),
  ("0,0032 en notation scientifique :", ["32 × 10⁻⁴", "3,2 × 10⁻³", "0,32 × 10⁻²", "3,2 × 10³"], 1, "1 ≤ 3,2 < 10 et on décale de 3 rangs."),
  ("−2⁴ vaut…", ["16", "−16", "8", "−8"], 1, "Sans parenthèses, la puissance s'applique à 2 seulement : −(2⁴) = −16.")]),

fiche("maths", 3, "Calcul littéral : développer et réduire", 2,
 "Développer, c'est transformer un produit en somme. Simple distributivité : k(a + b) = ka + kb. Double distributivité : (a + b)(c + d) = ac + ad + bc + bd. Ensuite, on réduit en regroupant les termes semblables.",
 [("Produire et calculer une expression", [
   "[ex] Programme de calcul : « choisir x, ajouter 3, multiplier par 2 » → 2(x + 3).",
   "Calculer pour x = −1 : 2 × (−1 + 3) = 2 × 2 = 4.",
   "[att] Remplace x par la valeur entre parenthèses si elle est négative : 3x² pour x = −2 → 3 × (−2)² = 12."]),
  ("Supprimer des parenthèses", [
   "Précédées de **+** : on garde les signes. a + (b − c) = a + b − c.",
   "Précédées de **−** : ==on change tous les signes==. a − (b − c) = a − b + c."]),
  ("Développer", [
   "- **Simple distributivité** : k(a + b) = ka + kb. Ex. : 3(2x − 5) = 6x − 15.\n- **Double distributivité** : (a + b)(c + d) = ac + ad + bc + bd.",
   "[ex] (x + 2)(3x − 1) = 3x² − x + 6x − 2 = ==3x² + 5x − 2==.",
   "[meth] Réduire : on additionne les termes en x², puis en x, puis les nombres."])],
 [("Développer 3(2x − 5)", ["6x − 5", "6x − 15", "5x − 15", "6x + 15"], 1, "3 × 2x = 6x et 3 × (−5) = −15."),
  ("a − (b − c) = ?", ["a − b − c", "a − b + c", "a + b − c", "a + b + c"], 1, "Un signe − devant la parenthèse change tous les signes."),
  ("(x + 2)(3x − 1) développé et réduit :", ["3x² + 5x − 2", "3x² − 2", "3x² + 7x − 2", "4x + 1"], 0, "3x² − x + 6x − 2 = 3x² + 5x − 2."),
  ("Valeur de 3x² pour x = −2 :", ["−12", "12", "36", "−36"], 1, "(−2)² = 4, donc 3 × 4 = 12."),
  ("« Choisir x, ajouter 3, multiplier par 2 » donne…", ["2x + 3", "2(x + 3)", "x + 6", "3x + 2"], 1, "On ajoute 3 d'abord, puis on multiplie le tout par 2.")]),

fiche("maths", 4, "Identités remarquables, factorisation et équations", 3,
 "(a + b)² = a² + 2ab + b² ; (a − b)² = a² − 2ab + b² ; (a + b)(a − b) = a² − b². Factoriser, c'est l'inverse de développer. Un produit est nul si l'un de ses facteurs est nul.",
 [("Les trois identités remarquables", [
   "- (a + b)² = ==a² + 2ab + b²==\n- (a − b)² = ==a² − 2ab + b²==\n- (a + b)(a − b) = ==a² − b²==",
   "[ex] (x + 5)² = x² + 10x + 25 ; (2x − 3)² = 4x² − 12x + 9 ; (x + 4)(x − 4) = x² − 16.",
   "[att] (a + b)² n'est PAS égal à a² + b² : n'oublie pas le double produit 2ab."]),
  ("Factoriser", [
   "Avec un **facteur commun** : 6x + 9 = 3(2x + 3) ; (x + 1)(x − 2) + (x + 1)(3x) = (x + 1)(4x − 2).",
   "Avec **a² − b²** : x² − 49 = (x + 7)(x − 7)."]),
  ("Résoudre une équation", [
   "[meth] Premier degré : on isole x. 3x − 5 = 2x + 4 → x = 9.",
   "**Équation produit nul** : si A × B = 0, alors ==A = 0 ou B = 0==.",
   "[ex] (x − 3)(2x + 8) = 0 → x = 3 ou x = −4. Deux solutions."])],
 [("(x + 5)² = ?", ["x² + 25", "x² + 10x + 25", "x² + 5x + 25", "2x + 10"], 1, "a² + 2ab + b² avec a = x et b = 5."),
  ("(x + 4)(x − 4) = ?", ["x² − 16", "x² + 16", "x² − 8x + 16", "2x"], 0, "(a + b)(a − b) = a² − b²."),
  ("Factoriser x² − 49 :", ["(x − 7)²", "(x + 7)(x − 7)", "x(x − 49)", "(x + 49)(x − 1)"], 1, "x² − 7² = (x + 7)(x − 7)."),
  ("Solutions de (x − 3)(2x + 8) = 0 :", ["3 et 4", "3 et −4", "−3 et 4", "seulement 3"], 1, "x − 3 = 0 donne 3 ; 2x + 8 = 0 donne −4."),
  ("Résoudre 3x − 5 = 2x + 4 :", ["x = 1", "x = −9", "x = 9", "x = 4"], 2, "3x − 2x = 4 + 5, donc x = 9.")]),

fiche("maths", 5, "Pythagore et Thalès", 3,
 "Pythagore : dans un triangle rectangle, le carré de l'hypoténuse est égal à la somme des carrés des deux autres côtés. Thalès : avec deux droites parallèles coupées par deux sécantes, les longueurs sont proportionnelles. Les réciproques prouvent qu'un triangle est rectangle ou que des droites sont parallèles.",
 [("Théorème de Pythagore", [
   "Si ABC est rectangle en A, alors ==BC² = AB² + AC²== (BC = hypoténuse, le plus grand côté).",
   "[ex] AB = 6 cm, AC = 8 cm : BC² = 36 + 64 = 100, donc BC = 10 cm.",
   "**Réciproque** : si BC² = AB² + AC², alors le triangle est rectangle en A. Sinon, il ne l'est pas."]),
  ("Théorème de Thalès", [
   "Si les points A, M, B et A, N, C sont alignés et (MN) // (BC), alors ==AM/AB = AN/AC = MN/BC==.",
   "[ex] AM = 3, AB = 5, BC = 10 : MN = 10 × 3/5 = 6.",
   "**Réciproque** : si AM/AB = AN/AC (et les points dans le même ordre), alors (MN) // (BC)."]),
  ("Rédiger au brevet", [
   "[meth] 1) Données (« Le triangle est rectangle en… », « les droites sont parallèles… »). 2) Nom du théorème. 3) Égalité. 4) Calcul et unité.",
   "[astuce] Pour la réciproque de Pythagore, calcule séparément le carré du plus grand côté et la somme des deux autres, puis compare."])],
 [("Dans ABC rectangle en A, l'hypoténuse est…", ["[AB]", "[AC]", "[BC]", "on ne sait pas"], 2, "C'est le côté opposé à l'angle droit."),
  ("AB = 6 cm et AC = 8 cm, triangle rectangle en A : BC = ?", ["14 cm", "10 cm", "100 cm", "48 cm"], 1, "36 + 64 = 100 et √100 = 10."),
  ("Un triangle de côtés 5, 12 et 13 est-il rectangle ?", ["Oui, car 13² = 5² + 12²", "Non", "On ne peut pas savoir", "Seulement s'il est isocèle"], 0, "169 = 25 + 144."),
  ("Avec Thalès, AM = 3, AB = 5, BC = 10 : MN = ?", ["6", "15", "2", "8"], 0, "MN = BC × AM/AB = 10 × 3/5 = 6."),
  ("Quelle condition faut-il pour appliquer Thalès ?", ["Un angle droit", "Deux droites parallèles", "Un triangle isocèle", "Un cercle"], 1, "Les droites (MN) et (BC) doivent être parallèles.")]),

fiche("maths", 6, "Méthode : automatismes et épreuve de maths", 2,
 "L'épreuve de maths du brevet dure 2 h. Elle commence par des automatismes (calcul mental, questions rapides), puis des exercices de problèmes. Il faut rédiger : chaque calcul doit être justifié, même si le résultat est faux une partie des points est gagnée.",
 [("Automatismes à maîtriser", [
   "- Calculer un pourcentage : 20 % de 50 = 0,2 × 50 = 10.\n- Priorités opératoires et nombres relatifs.\n- Fractions simples, puissances de 10.\n- Développer une expression, calculer une valeur.\n- Convertir des unités (1 h = 60 min, 1 m³ = 1 000 L)."]),
  ("Réussir les problèmes", [
   "[meth] Lis tout l'exercice, ==surligne les données==, fais un schéma. Écris une phrase de réponse avec l'unité.",
   "[astuce] Toute trace de recherche est prise en compte : ne laisse jamais une question vide."]),
  ("Le tableur et la programmation", [
   "Une formule de tableur commence par **=** (ex. « =2*A1+3 »).",
   "En Scratch, repère les boucles (« répéter »), les conditions (« si… alors ») et les variables."])],
 [("20 % de 50 = ?", ["5", "10", "20", "25"], 1, "0,2 × 50 = 10."),
  ("Combien de temps dure l'épreuve de maths ?", ["1 h", "2 h", "3 h", "4 h"], 1, "L'épreuve dure 2 heures."),
  ("1 m³ = combien de litres ?", ["10 L", "100 L", "1 000 L", "1 000 000 L"], 2, "1 dm³ = 1 L et 1 m³ = 1 000 dm³."),
  ("Une formule de tableur commence par…", ["#", "=", "+", "@"], 1, "Le signe = indique un calcul."),
  ("Que faire si on ne trouve pas le résultat ?", ["Laisser vide", "Écrire sa recherche, elle rapporte des points", "Recopier l'énoncé", "Mettre un résultat au hasard sans calcul"], 1, "Les essais et raisonnements sont valorisés.")]),
]
