package expo.modules.medicationsync

import java.util.Calendar

object KeywordRuleParser {
  private val FALLBACK_RE = Regex("""(오전|오후|AM|PM|am|pm)?\s*(\d{1,2})\s*[:시]\s*(\d{1,2})?""")

  /** original_time → 'HH:mm' or null */
  fun resolve(original: String, rules: List<Pair<String, String>>): String? {
    if (original.isBlank()) return null
    for ((kw, t) in rules) {
      if (original.contains(kw)) return t
    }
    val m = FALLBACK_RE.find(original) ?: return null
    val ampm = m.groupValues[1].lowercase()
    var h = m.groupValues[2].toIntOrNull() ?: return null
    val min = m.groupValues[3].toIntOrNull() ?: 0
    if (h !in 0..23 || min !in 0..59) return null
    if ((ampm == "오후" || ampm == "pm") && h < 12) h += 12
    if ((ampm == "오전" || ampm == "am") && h == 12) h = 0
    return "%02d:%02d".format(h, min)
  }

  fun hhmmToEpoch(dateYmd: String, hhmm: String): Long? {
    val parts = dateYmd.split("-").mapNotNull { it.toIntOrNull() }
    val hm = hhmm.split(":").mapNotNull { it.toIntOrNull() }
    if (parts.size != 3 || hm.size != 2) return null
    val cal = Calendar.getInstance().apply {
      set(parts[0], parts[1] - 1, parts[2], hm[0], hm[1], 0)
      set(Calendar.MILLISECOND, 0)
    }
    return cal.timeInMillis
  }
}
