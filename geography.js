// Explicit product geography registry: UN member states and the two observers.
// ISO 3166-1 also includes territories; two letters alone never imply a country.
export const COUNTRY_CODES = new Set(('AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW').split(' '));

export const TERRITORY_CODES = new Set(('AI AQ AS AW AX BL BM BQ BV CC CK CW CX EH FK FO GF GG GI GL GP GS GU HK HM IM IO JE KY MF MO MP MQ MS NC NF NU PF PM PN PR RE SH SJ SX TC TF TK TW UM VG VI WF XK YT').split(' '));

export function classifyGeography(entry) {
  const country=entry.country_code;
  const level=entry.geography_level||entry.geography_type||entry.level;
  const parent=entry.parent_country_code||entry.parent_country;
  const subdivision=entry.subdivision_code||entry.region_code||entry.state_code||entry.province_code;
  if (level==='territory'||TERRITORY_CODES.has(country)) return {level:'territory',code:country,country:parent||null};
  if (['state','province','region','subdivision'].includes(level)||subdivision||parent) {
    if (parent && COUNTRY_CODES.has(parent)) return {level:'region',country:parent,code:subdivision||entry.code||country};
    if (subdivision && COUNTRY_CODES.has(country)) return {level:'region',country,code:subdivision};
    return {level:'unknown',code:entry.code||country};
  }
  if ((!level||level==='country')&&COUNTRY_CODES.has(country)) return {level:'country',code:country,country};
  return {level:'unknown',code:country};
}

export function buildGeographyHierarchy(entries=[]) {
  const countries=[],regions=[],territories=[],unknown=[];
  for(const entry of entries){
    const geography=classifyGeography(entry),dataset={...entry,geography};
    ({country:countries,region:regions,territory:territories,unknown})[geography.level].push(dataset);
  }
  const childrenByCountry={};
  for(const region of regions)(childrenByCountry[region.geography.country] ||= []).push(region);
  return {countries,regions,territories,unknown,childrenByCountry,
    counts:{countries:countries.length,regions:regions.length,territories:territories.length,totalDatasets:entries.length,unknown:unknown.length}};
}
