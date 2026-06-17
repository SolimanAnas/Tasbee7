/**
 * i18n content-name dictionaries — surahs, reciters, radio stations.
 *
 * Stores ONLY the Latin (en/tr) forms. For ar/ckb/ur the helper
 * `I18n.name()` falls back to the Arabic name supplied by the caller
 * (the original data), since those languages use Arabic script and the
 * native Arabic names are correct as-is.
 *
 * Loaded as a classic script (NOT an ES module) after radio-stations.js.
 * Builds `window.I18N_NAMES = { surahs, reciters, stations }`.
 */
(function () {
  'use strict';

  // ---- Surah names (index 0 = surah 1) ------------------------------------
  const SURAH_EN = [
    'Al-Fatihah', 'Al-Baqarah', 'Aal-E-Imran', 'An-Nisa', 'Al-Maidah', "Al-An'am",
    "Al-A'raf", 'Al-Anfal', 'At-Tawbah', 'Yunus', 'Hud', 'Yusuf', "Ar-Ra'd", 'Ibrahim',
    'Al-Hijr', 'An-Nahl', 'Al-Isra', 'Al-Kahf', 'Maryam', 'Ta-Ha', 'Al-Anbiya', 'Al-Hajj',
    "Al-Mu'minun", 'An-Nur', 'Al-Furqan', "Ash-Shu'ara", 'An-Naml', 'Al-Qasas', 'Al-Ankabut',
    'Ar-Rum', 'Luqman', 'As-Sajdah', 'Al-Ahzab', 'Saba', 'Fatir', 'Ya-Sin', 'As-Saffat',
    'Sad', 'Az-Zumar', 'Ghafir', 'Fussilat', 'Ash-Shura', 'Az-Zukhruf', 'Ad-Dukhan',
    'Al-Jathiyah', 'Al-Ahqaf', 'Muhammad', 'Al-Fath', 'Al-Hujurat', 'Qaf', 'Adh-Dhariyat',
    'At-Tur', 'An-Najm', 'Al-Qamar', 'Ar-Rahman', "Al-Waqi'ah", 'Al-Hadid', 'Al-Mujadila',
    'Al-Hashr', 'Al-Mumtahanah', 'As-Saff', "Al-Jumu'ah", 'Al-Munafiqun', 'At-Taghabun',
    'At-Talaq', 'At-Tahrim', 'Al-Mulk', 'Al-Qalam', 'Al-Haqqah', "Al-Ma'arij", 'Nuh',
    'Al-Jinn', 'Al-Muzzammil', 'Al-Muddaththir', 'Al-Qiyamah', 'Al-Insan', 'Al-Mursalat',
    'An-Naba', "An-Nazi'at", 'Abasa', 'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin',
    'Al-Inshiqaq', 'Al-Buruj', 'At-Tariq', "Al-A'la", 'Al-Ghashiyah', 'Al-Fajr', 'Al-Balad',
    'Ash-Shams', 'Al-Layl', 'Ad-Duha', 'Ash-Sharh', 'At-Tin', 'Al-Alaq', 'Al-Qadr',
    'Al-Bayyinah', 'Az-Zalzalah', 'Al-Adiyat', "Al-Qari'ah", 'At-Takathur', 'Al-Asr',
    'Al-Humazah', 'Al-Fil', 'Quraysh', "Al-Ma'un", 'Al-Kawthar', 'Al-Kafirun', 'An-Nasr',
    'Al-Masad', 'Al-Ikhlas', 'Al-Falaq', 'An-Nas'
  ];
  const SURAH_TR = [
    'Fâtiha', 'Bakara', 'Âl-i İmrân', 'Nisâ', 'Mâide', "En'âm", "A'râf", 'Enfâl', 'Tevbe',
    'Yûnus', 'Hûd', 'Yûsuf', "Ra'd", 'İbrâhim', 'Hicr', 'Nahl', 'İsrâ', 'Kehf', 'Meryem',
    'Tâhâ', 'Enbiyâ', 'Hac', "Mü'minûn", 'Nûr', 'Furkân', 'Şuarâ', 'Neml', 'Kasas',
    'Ankebût', 'Rûm', 'Lokman', 'Secde', 'Ahzâb', 'Sebe', 'Fâtır', 'Yâsîn', 'Sâffât', 'Sâd',
    'Zümer', 'Gâfir', 'Fussilet', 'Şûrâ', 'Zuhruf', 'Duhân', 'Câsiye', 'Ahkâf', 'Muhammed',
    'Fetih', 'Hucurât', 'Kâf', 'Zâriyât', 'Tûr', 'Necm', 'Kamer', 'Rahmân', 'Vâkıa',
    'Hadîd', 'Mücâdele', 'Haşr', 'Mümtehine', 'Saff', 'Cuma', 'Münâfikûn', 'Tegâbün',
    'Talâk', 'Tahrîm', 'Mülk', 'Kalem', 'Hâkka', 'Meâric', 'Nûh', 'Cinn', 'Müzzemmil',
    'Müddessir', 'Kıyâme', 'İnsân', 'Mürselât', 'Nebe', 'Nâziât', 'Abese', 'Tekvîr',
    'İnfitâr', 'Mutaffifîn', 'İnşikâk', 'Bürûc', 'Târık', "A'lâ", 'Gâşiye', 'Fecr', 'Beled',
    'Şems', 'Leyl', 'Duhâ', 'İnşirâh', 'Tîn', 'Alak', 'Kadir', 'Beyyine', 'Zilzâl', 'Âdiyât',
    'Kâria', 'Tekâsür', 'Asr', 'Hümeze', 'Fîl', 'Kureyş', 'Mâûn', 'Kevser', 'Kâfirûn',
    'Nasr', 'Mesed', 'İhlâs', 'Felak', 'Nâs'
  ];

  // ---- Reciter names by audio-01.json `id` --------------------------------
  const RECITER_LATIN = {
    basit_murattal: 'Abdul Basit Abdul Samad (Murattal)',
    basit_mujawwad: 'Abdul Basit Abdul Samad (Mujawwad)',
    husary_murattal: 'Mahmoud Khalil Al-Hussary (Murattal)',
    husary_mujawwad: 'Mahmoud Khalil Al-Hussary (Mujawwad)',
    husary_warsh: 'Mahmoud Khalil Al-Hussary (Warsh)',
    minshawi_murattal: 'Mohamed Siddiq Al-Minshawi (Murattal)',
    minshawi_mujawwad: 'Mohamed Siddiq Al-Minshawi (Mujawwad)',
    minshawi_molim: "Mohamed Siddiq Al-Minshawi (Mu'allim)",
    minshawi_new: "Mohamed Siddiq Al-Minshawi (New Recitation)",
    banna_murattal: 'Mahmoud Ali Al-Banna (Murattal)',
    jibreel: 'Muhammad Jibreel', mustafa_ismail: 'Mustafa Ismail',
    sudais: 'Abdul Rahman Al-Sudais', shuraim: 'Saud Al-Shuraim',
    muaiqly: 'Maher Al-Muaiqly', dosari: 'Yasser Al-Dosari',
    juhany: 'Abdullah Al-Juhany', budair: 'Salah Al-Budair',
    hudhaify: 'Ali Al-Hudhaify', ajmi: 'Ahmad Al-Ajmi', ghamdi: 'Saad Al-Ghamdi',
    mishary_alafasy: "Mishary Rashid Alafasy (Juz')",
    '1': 'Ibrahim Al-Akhdar', '10': 'Akram Al-Alaqmi', '100': 'Majid Al-Anzi',
    '104': 'Mohammed Al-Ayrawi', '220': 'Ahmad Nuaina (Murattal)',
    '221': "Mishary Alafasy (Al-Duri 'an Al-Kisa'i)", '105': 'Mohammed Al-Barrak',
    '106': 'Mohammed Al-Tablawi', '107': 'Mohammed Al-Luhaidan', '108': 'Mohammed Al-Muhaisni',
    '109': 'Mohammed Ayyoub', '110': 'Mohammed Saleh Alim Shah', '115': 'Mohammed Abdul Karim',
    '116': 'Mohammed Abdul Hakim Saeed Al-Abdullah', '118': 'Mahmoud Khalil Al-Hussary (Qalun)',
    '123': 'Mishary Alafasy', '126': 'Mustafa Al-Lahuni', '127': 'Mustafa Raad Al-Azzawi',
    '129': 'Muftah Al-Sultani', '13': 'Al-Zain Mohammad Ahmad', '134': 'Mohammed Sayed',
    '136': 'Abdul Ilah bin Awn', '137': 'Ahmad Talib bin Humaid', '138': 'Noreen Mohammad Siddiq',
    '139': 'Majid Al-Zamel', '14': 'Al-Qari Yaseen', '149': 'Maher Shakhashero',
    '15': 'Al-Ushari Imran', '150': 'Mohammad Al-Munshid', '151': 'Mahmoud Al-Shimi',
    '152': 'Yasser Salamah', '159': 'Khalid Al-Muhanna', '16': 'Al-Oyoun Al-Koshi',
    '160': 'Adel Al-Kalbani', '161': 'Musa Bilal', '163': 'Hatem Fareed Al-Waer',
    '164': 'Ibrahim Al-Jarmi', '165': 'Mahmoud Al-Rifai', '17': 'Tawfeeq Al-Sayegh',
    '178': 'Ibrahim Al-Dosari', '18': 'Jamal Shaker Abdullah', '181': "Jam'an Al-Osaimi",
    '188': 'Abdul Ghani Abdullah', '189': 'Abdullah Fahmy', '19': 'Hamad Al-Daghreeri',
    '190': 'Mohammed Al-Hafiz', '191': 'Mohammed Hafs Ali', '192': 'Mohammed Khair Al-Noor',
    '193': 'Yousef bin Nuh Ahmad', '194': "Jamal Al-Din Al-Zayla'i", '197': "Mu'eedh Al-Harthi",
    '198': 'Mohammed Rashad Al-Sharif', '2': 'Ibrahim Al-Jibrin', '20': 'Khalid Al-Jalil',
    '201': 'Ahmad Al-Tarabulsi', '202': 'Abdullah Al-Kandari', '203': 'Ahmad Amer',
    '204': 'Ibrahim Al-Saadan', '205': 'Ahmad Al-Hudhaify', '206': 'Mohammed Othman Khan',
    '207': 'Yousef Al-Daghoush', '208': 'Al-Dukali Mohammad Al-Alem', '21': 'Khalid Al-Qahtani',
    '211': 'Al-Fateh Mohammad Al-Zubair', '21136': 'Abdullah Al-Qarafi',
    '21148': "Abdul Badi' Ghailan", '21181': 'Mohammed Burhaji', '21182': 'Yousef Al-Aidaroos',
    '21183': 'Hassan Al-Daghreeri', '21184': 'Mohammed Al-Faqih', '21186': 'Junaid Adam Abdullah',
    '21187': 'Khalid Al-Ziyadi', '21188': 'Al-Waleed Al-Shamsan', '21191': 'Ibrahim Al-Shahri',
    '21193': 'Abdul Rahman bin Abdul Razzaq Al-Badr', '21196': 'Alijan Quri Hamdan',
    '21197': 'Mohammed Al-Zubaidi', '212': 'Tareq Abdul Ghani Daawob', '216': 'Othman Al-Ansari',
    '217': 'Bandar Baleela', '218': 'Khalid Al-Shuraimi', '219': 'Wadee Al-Yamani',
    '22': 'Khalid Abdul Kafi', '63': 'Abdullah Ghailan', '64': 'Abdul Rasheed Sufi',
    '66': 'Abdul Mohsen Al-Harthi', '67': 'Abdul Mohsen Al-Qasim', '68': 'Abdul Mohsen Al-Askar',
    '69': 'Abdul Mohsen Al-Obaikan', '70': 'Abdul Hadi Ahmad Kanakari', '71': 'Abdul Wadood Hanif',
    '72': 'Abdul Wali Al-Arkani', '74': 'Ali bin Abdul Rahman Al-Hudhaify', '76': 'Ali Jaber',
    '77': 'Ali Hajjaj Al-Suwaisi', '78': 'Imad Zuhair Hafez', '79': 'Abdul Aziz Al-Turki',
    '8': 'Ahmad Saber', '80': 'Omar Al-Qazabri', '81': 'Fares Abbad', '83': 'Fahd Al-Kandari',
    '84': "Fawaz Al-Ka'bi", '86': 'Nasser Al-Qatami', '87': 'Nabil Al-Rifai',
    '88': "Ni'mah Al-Hassan", '89': 'Hani Al-Rifai', '9': 'Ahmad Nuaina',
    '90': 'Waleed Al-Dulaimi', '91': 'Waleed Al-Naehi', '92': 'Yasser Al-Dosari',
    '93': 'Yasser Al-Qurashi', '94': 'Yasser Al-Filkawi', '95': 'Yasser Al-Mazroyee',
    '96': 'Yahya Hawwa', '97': "Yousef Al-Shuwai'i", '98': 'Abdullah Abdul',
    '221_alt': 'Raad Mohammad Al-Kurdi', '226': 'Khalid Al-Ghamdi', '227': 'Ramadan Shakoor',
    '228': 'Abdul Majid Al-Arkani', '229': 'Mohammed Khalil Al-Qari', '23': 'Khalid Al-Wuhaibi',
    '230': "Rami Al-Du'ais", '236': 'Abdul Rahman Al-Majid', '237': 'Marwan Al-Akkari',
    '24': 'Khalifa Al-Tunaiji', '240': 'Salman Al-Otaibi', '241': 'Mohammed Rifat',
    '243': 'Abdullah Al-Mousa', '244': 'Abdullah Al-Khalaf', '245': 'Mansour Al-Salmi',
    '248': 'Nasser Al-Osfor', '25': 'Dawood Hamza', '250': 'Mohammed Al-Bukhait',
    '251': 'Nasser Al-Majid', '252': 'Ahmad Al-Suwailem', '254': 'Bader Al-Turki',
    '255': "Haitham Al-Jad'ani", '256': 'Ahmad Khalil Shaheen', '257': 'Saad Al-Muqrin',
    '260': 'Omar Al-Duraiwiz', '263': 'Abdul Aziz Al-Asiri', '264': 'Younes Aswailes',
    '265': 'Ahmad Deeban', '267': 'Abdullah Kamel', '268': 'Beshawa Qadir Al-Kurdi',
    '271': 'Nadheer Al-Maliki', '272': 'Okasha Kameni', '274': 'Mohammed Abu Snaineh',
    '275': 'Mohammed Al-Amin Qaniwa', '277': 'Mahmoud Abdul Hakam', '279': 'Ibrahim Kasheedan',
    '280': 'Hashem Abu Dalal', '281': 'Fuad Al-Khamri', '282': 'Sayed Ahmad Hashemi',
    '283': 'Khalid Karim Mohammadi', '284': 'Mal Allah Abdul Rahman Al-Jaber',
    '285': 'Salman Al-Siddiq', '286': 'Hassan Saleh', '287': 'Abdul Rahman Al-Shahhat',
    '288': 'Issa Omar Sanako', '289': 'Haroon Baqai', '29': 'Abdullah Bukhari',
    '290': 'Saleh Al-Quraishi', '3': 'Ibrahim Al-Asiri', '32': 'Sahl Yaseen',
    '33': 'Zaki Daghestani', '34': 'Sami Al-Hassan', '36': 'Sayed Ramadan',
    '38': 'Sherzad Abdul Rahman Taher', '39': 'Saber Abdul Hakam', '40': 'Saleh Al-Sahoud',
    '41': 'Saleh Al Talib', '42': 'Saleh Al-Habdan', '44': 'Salah Al-Hashim',
    '46': 'Salah Bukhatir', '48': 'Adel Rayyan', '49': 'Abdul Bari Al-Thubaiti',
    '50': 'Abdul Bari Mohammad', '55': 'Abdul Aziz Al-Ahmad', '57': 'Abdullah Al-Buraimi',
    '58': 'Abdullah Al-Buaijan', '59': 'Abdullah Al-Matroud', '60': 'Abdullah Basfar',
    '61': 'Abdullah Khayyat'
  };

  // ---- Radio station names (index aligned to RADIO_STATIONS order) --------
  const STATION_LATIN = [
    'Holy Quran Radio – Cairo', 'Holy Quran Radio – Makkah', 'Holy Quran Radio – Sharjah',
    'General Radio – Various Reciters', 'Humble Recitations Radio', 'Ruqyah Radio',
    'Morning Adhkar', 'Evening Adhkar', 'Surah Al-Baqarah – Various Reciters',
    'Short Selected Recitations', 'Abdul Basit Abdul Samad (Murattal)',
    'Mohamed Siddiq Al-Minshawi (Mujawwad)', 'Mahmoud Khalil Al-Hussary (Murattal)',
    'Mahmoud Khalil Al-Hussary (Mujawwad)', 'Mustafa Ismail', 'Mahmoud Ali Al-Banna (Mujawwad)',
    'Mohammed Al-Tablawi', 'Ahmad Nuaina', 'Abdul Rahman Al-Sudais', 'Maher Al-Muaiqly',
    'Yasser Al-Dosari', 'Mohammed Ayyoub – Special Recitation', 'Salah Al-Budair',
    'Abdul Mohsen Al-Qasim', 'Ali bin Abdul Rahman Al-Hudhaify', 'Abdullah Al-Matroud',
    'Mohammed Al-Luhaidan', 'Mustafa Al-Lahuni', 'Sheikh Abu Bakr Al-Shatri', 'Mishary Alafasy',
    'Ahmad Al-Ajmi', 'Nasser Al-Qatami', 'Waleed Al-Naehi', 'Salah Bukhatir', 'Salah Al-Hashim',
    "Yousef Al-Shuwai'i", 'Bandar Baleela', 'Fares Abbad', 'Ahmad Talib bin Humaid',
    'Abdul Bari Al-Thubaiti', 'Ahmad Saber', 'Mohammed Abdul Karim', 'Abdul Aziz Al-Ahmad',
    'Abdul Mohsen Al-Obaikan', 'Abdul Rasheed Sufi', 'Abdul Rasheed Sufi (Al-Susi)',
    "Muftah Al-Sultani (Al-Duri 'an Abi Amr)", 'Muftah Al-Sultani (Al-Duri)',
    'Muftah Al-Sultani (Ibn Dhakwan)', 'Mohammed Abdul Hakim Al-Abdullah (Al-Bazzi)',
    'Mohammed Abdul Hakim Al-Abdullah (Al-Duri)', 'Nasser Al-Majid', "Haitham Al-Jad'ani",
    'Khalid Al-Jalil', "Mu'eedh Al-Harthi", 'Zaki Daghestani', 'Sherzad Abdul Rahman Taher',
    'Akram Al-Alaqmi', 'Idrees Abkar', 'Al-Zain Mohammad Ahmad', 'Al-Qari Yaseen',
    'Omar Al-Qazabri', "Ni'mah Al-Hassan", 'Yahya Hawwa', 'Mohammad Saleh Alim Shah',
    'Mustafa Raad Al-Azzawi', 'Maher Shakhashero', 'Khalid Al-Muhanna', 'Musa Bilal',
    'Abdullah Al-Kandari', 'Mohammed Othman Khan', 'Al-Dukali Mohammad Al-Alem',
    'Al-Fateh Mohammad Al-Zubair', 'Tareq Abdul Ghani Daawob', 'Ahmad Deeban',
    'Mohammed Al-Amin Qaniwa', 'Abdul Aziz Suhaim', 'Khalid Abdul Kafi', 'Mahmoud Al-Shimi',
    'Saber Abdul Hakam', 'Sayed Ramadan', 'Sahl Yaseen', 'Tawfeeq Al-Sayegh',
    'Jamal Shaker Abdullah', 'Ali Hajjaj Al-Suwaisi', 'Imad Zuhair Hafez', 'Hani Al-Rifai',
    'Mahmoud Al-Rifai', 'Mohammed Rashad Al-Sharif', 'Ahmad Khader Al-Tarabulsi',
    'Ahmed Al-Tarabulsi', 'Ahmad Khalil Shaheen', 'Mohammed Abu Snaineh', 'Holy Quran Tafsir',
    'Quran Tafsir – Summary of Al-Tabari', 'Concise Quran Tafsir',
    "Tafsir of Quran's Rare Words", 'Concise Prophetic Biography', 'Stories of the Prophets',
    'Lives of the Companions', 'Riyad As-Salihin', 'Sahih Al-Bukhari',
    'Jurisprudential Choices (Fiqh)', 'Virtues of Ramadan', 'General Fatwas',
    'Quran Translation – Urdu (Abdul Basit)', 'Quran Translation – Urdu',
    'Quran Translation – Urdu', 'Quran Translation – English', 'Quran Translation – English',
    'Quran Translation – English (Walk)', 'Quran Translation – French',
    'Quran Translation – Portuguese', 'Quran Translation – Persian',
    'Quran Translation – Albanian', 'Quran Translation – Amazigh', 'Quran Translation – Hausa',
    'Quran Translation – Hungarian', 'Eid Takbeerat', 'Verses of Tranquility', 'Surah Al-Mulk',
    'Abdul Basit Abdul Samad (Mujawwad)', 'Abdul Basit Abdul Samad (Warsh)',
    'Mohamed Siddiq Al-Minshawi (Murattal)', 'Mahmoud Khalil Al-Hussary (Warsh)',
    'Mahmoud Ali Al-Banna (Murattal)', 'Saud Al-Shuraim', 'Ali Jaber', 'Mohammed Ayyoub',
    'Saad Al-Ghamdi', 'Ali Al-Hudhaify (Qalun)', 'Abdullah Awad Al-Juhany', 'Abdullah Basfar',
    'Abdullah Khayyat', 'Abdul Mohsen Al-Harthi', 'Muhammad Jibreel', 'Hazza Al-Balushi',
    'Ibrahim Al-Akhdar', 'Ahmad Al-Hawashi', 'Khaled Al-Qahtani', 'Khalifa Al-Tunaiji',
    'Yasser Al-Qurashi', 'Yasser Al-Mazroyee', 'Nasser Al-Osfor', 'Adel Al-Kalbani',
    'Mohammed Abdul Karim Al-Isbahani', 'Abdul Rahman Al-Majid', 'Majid Al-Zamel',
    'Bader Al-Turki', 'Abdullah Al-Mousa', 'Abdullah Al-Khalaf', 'Saleh Al-Habdan',
    'Abdullah Al-Buaijan', "Jam'an Al-Osaimi", 'Ibrahim Al-Dosari', 'Al-Oyoun Al-Koshi',
    'Hatem Fareed Al-Waer', 'Yousef bin Nuh Ahmad', 'Adel Rayyan', 'Nabil Al-Rifai',
    'Ahmed Amer', 'Abdul Rahman Al-Shahhat', 'In the Shade of the Prophetic Biography',
    'Sahih Muslim', 'Quran Translation – German', 'Quran Translation – Spanish',
    'Quran Translation – Turkish', 'Quran Translation – Russian', 'Quran Translation – Chinese',
    'Quran Translation – Kurdish', 'Quran Translation – Bosnian', 'Quran Translation – Korean',
    'Quran Translation – Greek'
  ];

  // ---- Build the lookup tables --------------------------------------------
  const surahs = {}, reciters = {}, stations = {};
  for (let i = 0; i < SURAH_EN.length; i++) {
    surahs[i + 1] = { en: SURAH_EN[i], tr: SURAH_TR[i] || SURAH_EN[i] };
  }
  for (const id in RECITER_LATIN) {
    const v = RECITER_LATIN[id];
    reciters[id] = { en: v, tr: v };
  }
  if (typeof RADIO_STATIONS !== 'undefined' && Array.isArray(RADIO_STATIONS)) {
    RADIO_STATIONS.forEach((s, i) => {
      const v = STATION_LATIN[i];
      if (v && s && s.name) stations[s.name] = { en: v, tr: v };
    });
  }

  window.I18N_NAMES = { surahs, reciters, stations };
})();
