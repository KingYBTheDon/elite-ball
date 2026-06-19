// Alternate names and nicknames, keyed by Basketball-Reference player_id.
// Two kinds:
//   - legal name changes / alternate spellings (Enes Kanter → Enes Freedom)
//   - well-known nicknames (Penny, KD, The Glove)
// Single-name nicknames that are just a first or last name (Giannis, Dirk, Manu)
// don't need an entry — matchPlayer already accepts a unique first/last name.
//
// Wired in at src/lib/dataset.ts (attached to each roster player) and consumed
// by src/lib/match.ts. Validated against the dataset by
// scripts/pipeline/check-aliases.mjs.

export const ALIASES: Record<string, string[]> = {
  // --- name changes & alternate spellings ---
  kanteen01: ["Enes Freedom"], // Enes Kanter
  artesro01: ["Metta World Peace", "Metta Sandiford-Artest"], // Ron Artest
  abdulka01: ["Lew Alcindor"], // Kareem Abdul-Jabbar
  abdulma02: ["Chris Jackson"], // Mahmoud Abdul-Rauf
  freewo01: ["Lloyd Free"], // World B. Free
  olajuha01: ["Akeem Olajuwon"], // Hakeem Olajuwon (early spelling)
  hilarne01: ["Nene"], // Nene Hilario

  // --- nicknames ---
  bryanko01: ["Black Mamba", "Mamba"], // Kobe Bryant
  jamesle01: ["King James", "LBJ", "The King"], // LeBron James
  onealsh01: ["Shaq", "The Diesel", "Big Aristotle"], // Shaquille O'Neal
  duranke01: ["KD", "Durantula", "Slim Reaper"], // Kevin Durant
  curryst01: ["Steph", "Chef Curry"], // Stephen Curry
  antetgi01: ["Greek Freak"], // Giannis Antetokounmpo
  jokicni01: ["Joker"], // Nikola Jokic
  lillada01: ["Dame", "Dame Dolla"], // Damian Lillard
  westbru01: ["Russ", "Brodie"], // Russell Westbrook
  hardeja01: ["The Beard"], // James Harden
  paulch01: ["CP3"], // Chris Paul
  anthoca01: ["Melo"], // Carmelo Anthony
  davisan02: ["The Brow", "AD"], // Anthony Davis
  iversal01: ["The Answer", "AI"], // Allen Iverson
  wadedw01: ["Flash", "D-Wade"], // Dwyane Wade
  garneke01: ["KG", "The Big Ticket"], // Kevin Garnett
  duncati01: ["The Big Fundamental"], // Tim Duncan
  cartevi01: ["Vinsanity", "Half Man Half Amazing"], // Vince Carter
  piercpa01: ["The Truth"], // Paul Pierce
  paytoga01: ["The Glove"], // Gary Payton
  robinda01: ["The Admiral"], // David Robinson
  rodmade01: ["The Worm"], // Dennis Rodman
  malonka01: ["The Mailman"], // Karl Malone
  barklch01: ["Sir Charles", "The Round Mound of Rebound"], // Charles Barkley
  thomais01: ["Zeke"], // Isiah Thomas
  gervige01: ["The Iceman", "Iceman"], // George Gervin
  dawkida01: ["Chocolate Thunder"], // Darryl Dawkins
  ervinju01: ["Dr. J", "Doctor J"], // Julius Erving
  maravpe01: ["Pistol Pete", "Pistol"], // Pete Maravich
  johnsma02: ["Magic", "Earvin Johnson"], // Magic Johnson
  hardaan01: ["Penny", "Penny Hardaway"], // Anfernee Hardaway
  boguemu01: ["Tyrone Bogues"], // Muggsy Bogues
  webbsp01: ["Anthony Webb"], // Spud Webb
  arenagi01: ["Agent Zero", "Hibachi"], // Gilbert Arenas
  mariosh01: ["The Matrix"], // Shawn Marion
  randoza01: ["Z-Bo"], // Zach Randolph
  couside01: ["Boogie"], // DeMarcus Cousins
  willija02: ["White Chocolate"], // Jason Williams
  horryro01: ["Big Shot Bob", "Big Shot Rob"], // Robert Horry
  anderch01: ["Birdman"], // Chris Andersen
  davisgl01: ["Big Baby"], // Glen Davis
  traylro01: ["Tractor"], // Robert Traylor
  reevebr01: ["Big Country"], // Bryant Reeves
  johnsla02: ["Grandmama"], // Larry Johnson
};
