const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

/** 3 → "٣" for the end-of-ayah marker ﴿٣﴾ */
export function toArabicIndic(n) {
  return String(n)
    .split('')
    .map((d) => ARABIC_INDIC[Number(d)] ?? d)
    .join('');
}
