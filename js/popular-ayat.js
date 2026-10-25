// Curated "Popular Ayat" for the video maker's quick-pick sheet.
// Every reference was checked against data/quran.json (surah:from–to).
// cat: famous | surahs | duas | comfort — the sheet groups rows in this order.
// Ranges stay within the video maker's 20-ayah limit.
window.POPULAR_AYAT = [
  // ---- Famous ayat ----
  { cat: 'famous', s: 2, from: 255, to: 255, ar: 'آية الكرسي', en: 'Ayat Al-Kursi' },
  { cat: 'famous', s: 2, from: 285, to: 286, ar: 'آخر آيتين من سورة البقرة', en: 'Last two ayat of Al-Baqarah' },
  { cat: 'famous', s: 24, from: 35, to: 35, ar: 'آية النور', en: 'Ayat An-Nur (the Verse of Light)' },
  { cat: 'famous', s: 18, from: 103, to: 110, ar: 'أواخر سورة الكهف', en: 'Closing ayat of Al-Kahf' },
  { cat: 'famous', s: 59, from: 22, to: 24, ar: 'خواتيم سورة الحشر', en: 'Closing ayat of Al-Hashr' },
  { cat: 'famous', s: 36, from: 82, to: 83, ar: 'خاتمة سورة يس', en: 'Closing ayat of Ya-Sin' },
  { cat: 'famous', s: 3, from: 190, to: 191, ar: 'إن في خلق السماوات والأرض', en: 'Signs for people of understanding' },
  { cat: 'famous', s: 33, from: 56, to: 56, ar: 'الصلاة على النبي ﷺ', en: 'Salawat upon the Prophet ﷺ' },
  { cat: 'famous', s: 3, from: 26, to: 27, ar: 'قل اللهم مالك الملك', en: 'Say: O Allah, Owner of sovereignty' },

  // ---- Short surahs ----
  { cat: 'surahs', s: 1, from: 1, to: 7, ar: 'سورة الفاتحة', en: 'Surah Al-Fatihah' },
  { cat: 'surahs', s: 112, from: 1, to: 4, ar: 'سورة الإخلاص', en: 'Surah Al-Ikhlas' },
  { cat: 'surahs', s: 113, from: 1, to: 5, ar: 'سورة الفلق', en: 'Surah Al-Falaq' },
  { cat: 'surahs', s: 114, from: 1, to: 6, ar: 'سورة الناس', en: 'Surah An-Nas' },
  { cat: 'surahs', s: 103, from: 1, to: 3, ar: 'سورة العصر', en: 'Surah Al-Asr' },
  { cat: 'surahs', s: 108, from: 1, to: 3, ar: 'سورة الكوثر', en: 'Surah Al-Kawthar' },
  { cat: 'surahs', s: 94, from: 1, to: 8, ar: 'سورة الشرح', en: 'Surah Ash-Sharh' },
  { cat: 'surahs', s: 67, from: 1, to: 5, ar: 'أول سورة الملك', en: 'Opening of Surah Al-Mulk' },

  // ---- Quranic duas ----
  { cat: 'duas', s: 2, from: 201, to: 201, ar: 'ربنا آتنا في الدنيا حسنة', en: 'Our Lord, give us good in this world' },
  { cat: 'duas', s: 3, from: 8, to: 8, ar: 'ربنا لا تزغ قلوبنا بعد إذ هديتنا', en: 'Our Lord, let not our hearts deviate' },
  { cat: 'duas', s: 14, from: 40, to: 41, ar: 'رب اجعلني مقيم الصلاة ومن ذريتي', en: 'My Lord, make me establish prayer' },
  { cat: 'duas', s: 20, from: 25, to: 28, ar: 'رب اشرح لي صدري', en: 'My Lord, expand my chest' },
  { cat: 'duas', s: 20, from: 114, to: 114, ar: 'وقل رب زدني علماً', en: 'My Lord, increase me in knowledge' },
  { cat: 'duas', s: 17, from: 24, to: 24, ar: 'رب ارحمهما كما ربياني صغيراً', en: 'My Lord, have mercy on my parents' },
  { cat: 'duas', s: 25, from: 74, to: 74, ar: 'ربنا هب لنا من أزواجنا وذرياتنا قرة أعين', en: 'Comfort of our eyes in spouses and children' },
  { cat: 'duas', s: 21, from: 87, to: 87, ar: 'لا إله إلا أنت سبحانك إني كنت من الظالمين', en: 'The dua of Yunus' },
  { cat: 'duas', s: 28, from: 24, to: 24, ar: 'رب إني لما أنزلت إلي من خير فقير', en: 'My Lord, I am in need of any good' },
  { cat: 'duas', s: 7, from: 23, to: 23, ar: 'ربنا ظلمنا أنفسنا', en: 'Our Lord, we have wronged ourselves' },
  { cat: 'duas', s: 27, from: 19, to: 19, ar: 'رب أوزعني أن أشكر نعمتك', en: 'My Lord, enable me to be grateful' },
  { cat: 'duas', s: 3, from: 38, to: 38, ar: 'رب هب لي من لدنك ذرية طيبة', en: 'My Lord, grant me righteous offspring' },
  { cat: 'duas', s: 2, from: 127, to: 128, ar: 'ربنا تقبل منا إنك أنت السميع العليم', en: 'Our Lord, accept from us' },
  { cat: 'duas', s: 3, from: 173, to: 173, ar: 'حسبنا الله ونعم الوكيل', en: 'Allah is sufficient for us' },
  { cat: 'duas', s: 9, from: 129, to: 129, ar: 'حسبي الله لا إله إلا هو', en: 'Allah is sufficient for me' },
  { cat: 'duas', s: 23, from: 118, to: 118, ar: 'رب اغفر وارحم وأنت خير الراحمين', en: 'My Lord, forgive and have mercy' },
  { cat: 'duas', s: 2, from: 250, to: 250, ar: 'ربنا أفرغ علينا صبراً', en: 'Our Lord, pour patience upon us' },
  { cat: 'duas', s: 40, from: 44, to: 44, ar: 'وأفوض أمري إلى الله', en: 'I entrust my affair to Allah' },
  { cat: 'duas', s: 71, from: 10, to: 12, ar: 'استغفروا ربكم إنه كان غفاراً', en: 'Seek your Lord\'s forgiveness' },

  // ---- Comfort & reminders ----
  { cat: 'comfort', s: 50, from: 16, to: 16, ar: 'ولقد خلقنا الإنسان ونعلم ما توسوس به نفسه', en: 'We know what his soul whispers to him' },
  { cat: 'comfort', s: 25, from: 27, to: 29, ar: 'ويوم يعض الظالم على يديه', en: 'The Day the wrongdoer will bite his hands' },
  { cat: 'comfort', s: 13, from: 28, to: 28, ar: 'ألا بذكر الله تطمئن القلوب', en: 'In the remembrance of Allah hearts find rest' },
  { cat: 'comfort', s: 2, from: 186, to: 186, ar: 'وإذا سألك عبادي عني فإني قريب', en: 'Indeed, I am near' },
  { cat: 'comfort', s: 39, from: 53, to: 53, ar: 'لا تقنطوا من رحمة الله', en: 'Do not despair of Allah\'s mercy' },
  { cat: 'comfort', s: 2, from: 152, to: 152, ar: 'فاذكروني أذكركم', en: 'Remember Me; I will remember you' },
  { cat: 'comfort', s: 2, from: 155, to: 157, ar: 'إنا لله وإنا إليه راجعون', en: 'To Allah we belong and to Him we return' },
  { cat: 'comfort', s: 2, from: 45, to: 46, ar: 'واستعينوا بالصبر والصلاة', en: 'Seek help through patience and prayer' },
  { cat: 'comfort', s: 12, from: 86, to: 86, ar: 'إنما أشكو بثي وحزني إلى الله', en: 'I complain of my grief only to Allah' },
  { cat: 'comfort', s: 29, from: 69, to: 69, ar: 'والذين جاهدوا فينا لنهدينهم سبلنا', en: 'We will surely guide them to Our ways' },
  { cat: 'comfort', s: 57, from: 20, to: 20, ar: 'اعلموا أنما الحياة الدنيا لعب ولهو', en: 'The life of this world is but play' },
];
