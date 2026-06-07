// ChordNinja Dynamic Chord Generation Engine
// Supports 12 root notes * 12 chord types = 144 chords.
// Pitch class notation: 0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B

const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const PITCH_VALS = {
  "C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, 
  "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11
};

const TYPES = {
  "Major": { suffix: "", intervals: [0, 4, 7] },
  "Minor": { suffix: "m", intervals: [0, 3, 7] },
  "7": { suffix: "7", intervals: [0, 4, 7, 10] },
  "5": { suffix: "5", intervals: [0, 7] },
  "dim": { suffix: "dim", intervals: [0, 3, 6] },
  "dim7": { suffix: "dim7", intervals: [0, 3, 6, 9] },
  "aug": { suffix: "aug", intervals: [0, 4, 8] },
  "sus2": { suffix: "sus2", intervals: [0, 2, 7] },
  "sus4": { suffix: "sus4", intervals: [0, 5, 7] },
  "maj7": { suffix: "maj7", intervals: [0, 4, 7, 11] },
  "m7": { suffix: "m7", intervals: [0, 3, 7, 10] },
  "7sus4": { suffix: "7sus4", intervals: [0, 5, 7, 10] }
};

// Hardcoded popular beginner open chords for maximum finger accuracy
const OPEN_CHORDS = {
  "Em": { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  "Am": { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  "E":  { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  "A":  { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  "C":  { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  "G":  { frets: [3, 2, 0, 0, 0, 3], fingers: [3, 2, 0, 0, 0, 4] },
  "D":  { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  "Dm": { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  "E5": { frets: [0, 2, 2, -1, -1, -1], fingers: [0, 1, 2, 0, 0, 0] },
  "A5": { frets: [-1, 0, 2, 2, -1, -1], fingers: [0, 0, 1, 2, 0, 0] },
  "Asus2": { frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
  "Dsus2": { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0] },
  "Esus4": { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0] },
  "Asus4": { frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 4, 0] },
  "Dsus4": { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4] },
  "E7":  { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  "A7":  { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 1, 0, 2, 0] },
  "D7":  { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  "G7":  { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  "C7":  { frets: [-1, 3, 2, 3, 1, -1], fingers: [0, 3, 2, 4, 1, 0] },
  "B7":  { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  "Cmaj7": { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  "Fmaj7": { frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  "Amaj7": { frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
  "Dmaj7": { frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1] },
  "Am7":  { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  "Dm7":  { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
  "Em7":  { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 1, 0, 0, 0, 0] }
};

// Root positions on E string (6) and A string (5) for barre calculations
const E_STRING_ROOTS = { "E": 0, "F": 1, "F#": 2, "G": 3, "G#": 4, "A": 5, "A#": 6, "B": 7, "C": 8, "C#": 9, "D": 10, "D#": 11 };
const A_STRING_ROOTS = { "A": 0, "A#": 1, "B": 2, "C": 3, "C#": 4, "D": 5, "D#": 6, "E": 7, "F": 8, "F#": 9, "G": 10, "G#": 11 };

// Helper to determine notes in a chord based on intervals
function getChordNotes(rootVal, intervals) {
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const stringNotes = ["E", "A", "D", "G", "B", "e"]; // High-to-low representation placeholder
  
  // Calculate notes at index 0..5 corresponding to strings 6..1
  // Standard tuning: String 6=E, 5=A, 4=D, 3=G, 2=B, 1=E
  // For simplicity we return string notes based on frets
  return [];
}

// Generate the complete CHORDS dictionary
export const CHORDS = {};

ROOTS.forEach(root => {
  for (const typeKey in TYPES) {
    const type = TYPES[typeKey];
    const chordKey = root + type.suffix;
    
    // 1. Calculate Chroma
    const chroma = new Array(12).fill(0);
    const rootVal = PITCH_VALS[root];
    type.intervals.forEach(interval => {
      const pc = (rootVal + interval) % 12;
      chroma[pc] = 1.0;
    });

    // 2. Check if popular open shape is defined
    let frets = [];
    let fingers = [];
    if (OPEN_CHORDS[chordKey]) {
      frets = OPEN_CHORDS[chordKey].frets;
      fingers = OPEN_CHORDS[chordKey].fingers;
    } else {
      // Algorithmic Barre Chord Calculator
      // Decide if root is lower on 6th string or 5th string
      const fret6 = E_STRING_ROOTS[root] !== undefined ? E_STRING_ROOTS[root] : (E_STRING_ROOTS[root.replace("#", "")] + 1);
      const fret5 = A_STRING_ROOTS[root] !== undefined ? A_STRING_ROOTS[root] : (A_STRING_ROOTS[root.replace("#", "")] + 1);
      
      const use5 = (fret5 < fret6 && fret5 > 0) || fret6 === 0 || fret6 > 10;
      const f = use5 ? fret5 : fret6;

      if (use5) {
        // Root on String 5 (A string)
        switch(typeKey) {
          case "Major":
            frets = [-1, f, f+2, f+2, f+2, f];
            fingers = [0, 1, 2, 3, 4, 1];
            break;
          case "Minor":
            frets = [-1, f, f+2, f+2, f+1, f];
            fingers = [0, 1, 3, 4, 2, 1];
            break;
          case "7":
            frets = [-1, f, f+2, f, f+2, f];
            fingers = [0, 1, 3, 1, 4, 1];
            break;
          case "5":
            frets = [-1, f, f+2, f+2, -1, -1];
            fingers = [0, 1, 3, 4, 0, 0];
            break;
          case "dim":
            frets = [-1, f, f+1, f, -1, -1];
            fingers = [0, 1, 3, 2, 0, 0];
            break;
          case "dim7":
            frets = [-1, f, f+1, f, f+1, -1];
            fingers = [0, 1, 3, 2, 4, 0];
            break;
          case "aug":
            frets = [-1, f, f+2, f+2, f+2, -1];
            fingers = [0, 1, 2, 3, 4, 0];
            break;
          case "sus2":
            frets = [-1, f, f+2, f+2, f, f];
            fingers = [0, 1, 3, 4, 1, 1];
            break;
          case "sus4":
            frets = [-1, f, f+2, f+2, f+3, f];
            fingers = [0, 1, 3, 4, 2, 1];
            break;
          case "maj7":
            frets = [-1, f, f+2, f+1, f+2, f];
            fingers = [0, 1, 3, 2, 4, 1];
            break;
          case "m7":
            frets = [-1, f, f+2, f, f+1, f];
            fingers = [0, 1, 3, 1, 2, 1];
            break;
          case "7sus4":
            frets = [-1, f, f+2, f, f+3, f];
            fingers = [0, 1, 3, 1, 4, 1];
            break;
          default:
            frets = [-1, f, f+2, f+2, f, f];
            fingers = [0, 1, 3, 4, 1, 1];
        }
      } else {
        // Root on String 6 (E string)
        switch(typeKey) {
          case "Major":
            frets = [f, f+2, f+2, f+1, f, f];
            fingers = [1, 3, 4, 2, 1, 1];
            break;
          case "Minor":
            frets = [f, f+2, f+2, f, f, f];
            fingers = [1, 3, 4, 1, 1, 1];
            break;
          case "7":
            frets = [f, f+2, f, f+1, f, f];
            fingers = [1, 3, 1, 2, 1, 1];
            break;
          case "5":
            frets = [f, f+2, f+2, -1, -1, -1];
            fingers = [1, 3, 4, 0, 0, 0];
            break;
          case "dim":
            frets = [f, -1, f+1, f+1, -1, -1];
            fingers = [1, 0, 3, 2, 0, 0];
            break;
          case "dim7":
            frets = [f, -1, f+1, f+2, f, -1];
            fingers = [1, 0, 2, 4, 1, 0];
            break;
          case "aug":
            frets = [f, f+2, f+2, f+1, -1, -1];
            fingers = [1, 3, 4, 2, 0, 0];
            break;
          case "sus2":
            frets = [f, f+2, f+2, -1, -1, -1];
            fingers = [1, 3, 4, 0, 0, 0];
            break;
          case "sus4":
            frets = [f, f+2, f+2, f+2, f, f];
            fingers = [1, 3, 4, 2, 1, 1];
            break;
          case "maj7":
            frets = [f, -1, f+1, f+1, f, -1];
            fingers = [1, 0, 3, 4, 2, 0];
            break;
          case "m7":
            frets = [f, f+2, f, f, f, f];
            fingers = [1, 3, 1, 1, 1, 1];
            break;
          case "7sus4":
            frets = [f, f+2, f, f+2, f, f];
            fingers = [1, 3, 1, 4, 1, 1];
            break;
          default:
            frets = [f, f+2, f+2, f, f, f];
            fingers = [1, 3, 4, 1, 1, 1];
        }
      }
    }

    // 3. Compute note names per string (standard tuning)
    const tuningNotes = ["E", "A", "D", "G", "B", "e"];
    const noteMap = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const stringBaseVals = [4, 9, 2, 7, 11, 4]; // tuning semitones mapping
    
    const noteLabels = frets.map((fret, idx) => {
      if (fret === -1) return "X";
      const semitone = (stringBaseVals[idx] + fret) % 12;
      return noteMap[semitone];
    });

    CHORDS[chordKey] = {
      name: `${root} ${typeKey}`,
      shortName: chordKey,
      chroma,
      frets,
      fingers,
      notes: noteLabels
    };
  }
});

// Segmented 10-Tier Pedagogical Progression Hierarchy
export const TIERS = [
  {
    id: 1,
    name: "Tier 1: Beginner Basics I",
    chords: ["Em", "Am", "E", "A"],
    description: "Your very first chords. Focus on finger clarity and standard anchor changes."
  },
  {
    id: 2,
    name: "Tier 2: Beginner Basics II",
    chords: ["C", "G", "D", "Dm"],
    description: "Completing the essential open chord group. Watch out for the stretch on G and C."
  },
  {
    id: 3,
    name: "Tier 3: Rock Power Chords",
    chords: ["E5", "A5", "C5", "D5", "G5", "F5", "B5"],
    description: "Dual-string root-fifth chords. The foundation of classic rock rhythms."
  },
  {
    id: 4,
    name: "Tier 4: Suspended Cadences",
    chords: ["Asus2", "Dsus2", "Esus2", "Asus4", "Dsus4", "Esus4", "Gsus4"],
    description: "Chords with tension waiting to resolve. The third is replaced by a second or fourth."
  },
  {
    id: 5,
    name: "Tier 5: Dominant Sevenths",
    chords: ["E7", "A7", "D7", "G7", "C7", "B7"],
    description: "Adding the bluesy minor 7th note to major triads. Essential for blues progressions."
  },
  {
    id: 6,
    name: "Tier 6: Jazz Foundations",
    chords: ["Cmaj7", "Fmaj7", "Amaj7", "Dmaj7", "Am7", "Dm7", "Em7"],
    description: "Sophisticated, mellow seventh chords. The backbone of jazz and lo-fi aesthetics."
  },
  {
    id: 7,
    name: "Tier 7: Barre Chord Milestones",
    chords: ["F", "Fm", "F#", "F#m", "G#", "G#m", "B", "Bm", "C#m"],
    description: "Using your index finger as a movable nut. The ultimate milestone for beginner guitarists."
  },
  {
    id: 8,
    name: "Tier 8: Suspended 7ths",
    chords: ["E7sus4", "A7sus4", "D7sus4", "G7sus4", "C7sus4"],
    description: "A combination of dominant 7th and suspended fourth. Highly dramatic and colorful."
  },
  {
    id: 9,
    name: "Tier 9: Diminished & Augmented Triads",
    chords: ["Cdim", "Ddim", "Edim", "Bdim", "Caug", "Daug", "Eaug", "Gaug"],
    description: "Tense intervals (diminished 5th and augmented 5th) used for transitional runs."
  },
  {
    id: 10,
    name: "Tier 10: The Master Ninja",
    chords: ["Cdim7", "Ddim7", "Edim7", "Fdim7", "Gdim7", "Adim7", "Bdim7"],
    description: "Diminished seventh shapes. The ultimate symmetric chord for tense filmic changes."
  }
];

export function calculateChordSimilarity(userChroma, targetChroma) {
  const smoothUser = new Array(12).fill(0);
  const smoothTarget = new Array(12).fill(0);

  // Apply circular convolved smoothing [0.22, 1.0, 0.22] to handle pitch bleed and minor tuning drift
  for (let i = 0; i < 12; i++) {
    const prev = (i - 1 + 12) % 12;
    const next = (i + 1) % 12;
    smoothUser[i] = userChroma[i] + 0.22 * userChroma[prev] + 0.22 * userChroma[next];
    smoothTarget[i] = targetChroma[i] + 0.22 * targetChroma[prev] + 0.22 * targetChroma[next];
  }

  let dotProduct = 0;
  let normUser = 0;
  let normTarget = 0;

  for (let i = 0; i < 12; i++) {
    dotProduct += smoothUser[i] * smoothTarget[i];
    normUser += smoothUser[i] * smoothUser[i];
    normTarget += smoothTarget[i] * smoothTarget[i];
  }

  if (normUser === 0 || normTarget === 0) return 0;
  return dotProduct / (Math.sqrt(normUser) * Math.sqrt(normTarget));
}

// Static database of popular song examples for guitar chords
export const SONG_EXAMPLES = {
  // Tier 1
  "Em": [
    { title: "Wish You Were Here", artist: "Pink Floyd" },
    { title: "Zombie", artist: "The Cranberries" },
    { title: "Heart of Gold", artist: "Neil Young" }
  ],
  "Am": [
    { title: "House of the Rising Sun", artist: "The Animals" },
    { title: "Losing My Religion", artist: "R.E.M." },
    { title: "Stairway to Heaven", artist: "Led Zeppelin" }
  ],
  "E": [
    { title: "Hey Joe", artist: "Jimi Hendrix" },
    { title: "Rumble", artist: "Link Wray" },
    { title: "For What It's Worth", artist: "Buffalo Springfield" }
  ],
  "A": [
    { title: "Three Little Birds", artist: "Bob Marley" },
    { title: "Back in Black", artist: "AC/DC" },
    { title: "Wild Thing", artist: "The Troggs" }
  ],
  // Tier 2
  "C": [
    { title: "Imagine", artist: "John Lennon" },
    { title: "Let It Be", artist: "The Beatles" },
    { title: "No Woman No Cry", artist: "Bob Marley" }
  ],
  "G": [
    { title: "Sweet Home Alabama", artist: "Lynyrd Skynyrd" },
    { title: "Knockin' on Heaven's Door", artist: "Bob Dylan" },
    { title: "Good Riddance (Time of Your Life)", artist: "Green Day" }
  ],
  "D": [
    { title: "Free Fallin'", artist: "Tom Petty" },
    { title: "Hotel California", artist: "Eagles" },
    { title: "Summer of '69", artist: "Bryan Adams" }
  ],
  "Dm": [
    { title: "Sultans of Swing", artist: "Dire Straits" },
    { title: "Layla", artist: "Eric Clapton" },
    { title: "Mad World", artist: "Tears for Fears" }
  ],
  // Tier 3 (Power chords)
  "E5": [
    { title: "Rock You Like a Hurricane", artist: "Scorpions" },
    { title: "Iron Man", artist: "Black Sabbath" }
  ],
  "A5": [
    { title: "Smells Like Teen Spirit", artist: "Nirvana" },
    { title: "You Shook Me All Night Long", artist: "AC/DC" }
  ],
  "C5": [
    { title: "Basket Case", artist: "Green Day" },
    { title: "American Idiot", artist: "Green Day" }
  ],
  "D5": [
    { title: "Eye of the Tiger", artist: "Survivor" },
    { title: "Holiday", artist: "Green Day" }
  ],
  "G5": [
    { title: "TNT", artist: "AC/DC" },
    { title: "Self Esteem", artist: "The Offspring" }
  ],
  "F5": [
    { title: "Smells Like Teen Spirit", artist: "Nirvana" },
    { title: "Brain Stew", artist: "Green Day" }
  ],
  "B5": [
    { title: "Lithium", artist: "Nirvana" },
    { title: "Everlong", artist: "Foo Fighters" }
  ],
  // Tier 4 (Suspended)
  "Asus2": [
    { title: "Clocks", artist: "Coldplay" },
    { title: "Message in a Bottle", artist: "The Police" }
  ],
  "Dsus2": [
    { title: "Every Breath You Take", artist: "The Police" },
    { title: "Copperhead Road", artist: "Steve Earle" }
  ],
  "Esus2": [
    { title: "Unturned", artist: "The Smiths" }
  ],
  "Asus4": [
    { title: "Happy Xmas (War Is Over)", artist: "John Lennon" },
    { title: "Need You Now", artist: "Lady A" }
  ],
  "Dsus4": [
    { title: "A Hard Day's Night", artist: "The Beatles" },
    { title: "Wish You Were Here", artist: "Pink Floyd" }
  ],
  "Esus4": [
    { title: "Pinball Wizard", artist: "The Who" },
    { title: "Cold as Ice", artist: "Foreigner" }
  ],
  "Gsus4": [
    { title: "You Can't Always Get What You Want", artist: "The Rolling Stones" }
  ],
  // Tier 5 (Dominant 7ths)
  "E7": [
    { title: "Pride and Joy", artist: "Stevie Ray Vaughan" },
    { title: "Hound Dog", artist: "Elvis Presley" }
  ],
  "A7": [
    { title: "I Got You (I Feel Good)", artist: "James Brown" },
    { title: "La Grange", artist: "ZZ Top" }
  ],
  "D7": [
    { title: "Brown Eyed Girl", artist: "Van Morrison" },
    { title: "Tequila", artist: "The Champs" }
  ],
  "G7": [
    { title: "I'm a Believer", artist: "The Monkees" },
    { title: "Help!", artist: "The Beatles" }
  ],
  "C7": [
    { title: "Taxman", artist: "The Beatles" },
    { title: "Midnight Special", artist: "Creedence Clearwater Revival" }
  ],
  "B7": [
    { title: "Hotel California", artist: "Eagles" },
    { title: "Heartbreak Hotel", artist: "Elvis Presley" }
  ],
  // Tier 6 (Jazz 7ths)
  "Cmaj7": [
    { title: "Imagine", artist: "John Lennon" },
    { title: "Something", artist: "The Beatles" }
  ],
  "Fmaj7": [
    { title: "Dust in the Wind", artist: "Kansas" },
    { title: "Space Oddity", artist: "David Bowie" }
  ],
  "Amaj7": [
    { title: "Under the Bridge", artist: "Red Hot Chili Peppers" },
    { title: "Don't Go Breaking My Heart", artist: "Elton John" }
  ],
  "Dmaj7": [
    { title: "Rainy Days and Mondays", artist: "Carpenters" },
    { title: "Light My Fire", artist: "The Doors" }
  ],
  "Am7": [
    { title: "Ain't No Sunshine", artist: "Bill Withers" },
    { title: "Wonderwall", artist: "Oasis" }
  ],
  "Dm7": [
    { title: "Fly Me to the Moon", artist: "Frank Sinatra" },
    { title: "Moondance", artist: "Van Morrison" }
  ],
  "Em7": [
    { title: "Wonderwall", artist: "Oasis" },
    { title: "Wish You Were Here", artist: "Pink Floyd" }
  ],
  // Tier 7 (Barre chords)
  "F": [
    { title: "House of the Rising Sun", artist: "The Animals" },
    { title: "Like a Rolling Stone", artist: "Bob Dylan" }
  ],
  "Fm": [
    { title: "Creep", artist: "Radiohead" },
    { title: "All The Things She Said", artist: "t.A.T.u." }
  ],
  "F#": [
    { title: "All Right Now", artist: "Free" }
  ],
  "F#m": [
    { title: "Hotel California", artist: "Eagles" },
    { title: "Wonderwall", artist: "Oasis" }
  ],
  "G#": [
    { title: "Smells Like Teen Spirit", artist: "Nirvana" }
  ],
  "G#m": [
    { title: "I Shot the Sheriff", artist: "Bob Marley" }
  ],
  "B": [
    { title: "Creep", artist: "Radiohead" }
  ],
  "Bm": [
    { title: "Hotel California", artist: "Eagles" },
    { title: "Comfortably Numb", artist: "Pink Floyd" }
  ],
  "C#m": [
    { title: "Californication", artist: "Red Hot Chili Peppers" },
    { title: "Message in a Bottle", artist: "The Police" }
  ]
};

// Returns song examples for a chord. If none found, generates standard ones based on chord qualities.
export function getSongExamples(chordKey) {
  if (SONG_EXAMPLES[chordKey]) {
    return SONG_EXAMPLES[chordKey];
  }
  
  // Dynamic fallback examples for other generated chords
  if (chordKey.endsWith("m7")) {
    return [
      { title: "Autumn Leaves", artist: "Jazz Standard" },
      { title: "Blue Bossa", artist: "Jazz Standard" }
    ];
  } else if (chordKey.endsWith("maj7")) {
    return [
      { title: "Fly Me to the Moon", artist: "Frank Sinatra" },
      { title: "Girl from Ipanema", artist: "Antônio Carlos Jobim" }
    ];
  } else if (chordKey.endsWith("7")) {
    return [
      { title: "12-Bar Blues Progression", artist: "Traditional Blues" },
      { title: "Johnny B. Goode", artist: "Chuck Berry" }
    ];
  } else if (chordKey.endsWith("m")) {
    return [
      { title: "Typical Minor Progression", artist: "Classical/Rock" }
    ];
  } else if (chordKey.endsWith("5")) {
    return [
      { title: "Rock Riff in " + chordKey.replace("5", ""), artist: "Various Artists" }
    ];
  }
  
  // Absolute fallback
  return [
    { title: "Guitar Song in " + chordKey, artist: "Popular Progression" }
  ];
}

