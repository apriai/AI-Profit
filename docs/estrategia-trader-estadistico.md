# Trader Estadístico — Full Strategy Handoff
*For a new AI assistant working with Bänéd. Compiled Oct 16, 2026 from the "Trading Strategy" assistant's memory and work. Read all of it before advising.*

---

## 0. Who you're working with
- **User:** Bänéd. Time zone America/New_York (ET). Writes in Spanish and English; student/course content is **always Spanish**.
- **Brand:** **Trader Estadístico** (traderestadistico.com). Sells a course teaching this method. Own calculator: **traderestadistico.com/calculadora** (presentation: /calculadora/presentacion.html).
- **Style preferences:** warm, concise; teaching materials with **minimal text, one idea + one big number per slide**, visual. Text-heavy material is hard for them to follow.
- **Key vocabulary:** always say **"esperanza matemática"** (never "media" or "promedio"). Closing line: **"Basado en matemática estadística."**
- **Hard boundaries (keep these):**
  - The AI **never logs into or trades the user's prop accounts** (account-sharing bans). It designs rules, sizes brackets and coaches; the user clicks.
  - **Never hedge between accounts** (opposite trades across accounts or with a friend). It breaks prop rules and EV ≈ 0.
  - **No taking investor/client money** to trade (e.g., "crypto mining" front). It is fraud / unregistered pool. The legal path is selling education.
  - **No income promises or results guarantees** in marketing. Always add "Números aproximados, no es promesa de ganancias."

---

## 1. Core idea (why it works)
The edge is **not a price-prediction signal**. It comes from the **structure of prop-firm accounts plus discipline**:
- Each account is a **cheap ticket (~$50)** that can pay **~$900 per payout** (a $1,000 payout at a 90% split), with up to ~3 payouts modelled.
- The market is modelled as a **fair 50/50 coin** (worst case). With fixed TP/SL, the probability of hitting TP before SL is:
  **P(TP first) = SL ÷ (TP + SL)** (gambler's-ruin / barrier math).
- **Esperanza matemática = Σ (cumulative probability of reaching each payout × net payout) − ticket price.**
- Most accounts lose, but the ones that pay cover all the losers and leave a profit **on average over many accounts**. It's a **multi-account game**; one account proves nothing.
- If the trader has a real setup edge (>50%), the odds only improve. Student line: *"La rifa es el peor caso (moneda justa). Si operas con ventaja real, la matemática se pone a tu favor."*
- Probability is the **same with 10 or 20 contracts**; only the dollar TP/SL ratio matters. More contracts just means fewer points per dollar and more commissions.
- **High probability ≠ edge.** Example: a +$100 day with no stop ($1,000 drawdown left) = 1000/1100 = **90.9%** win, but EV ≈ $0. With a $600 stop: 600/700 = **85.7%**. Those small days exist only to satisfy green-day rules.

---

## 2. Strategy #1 — LucidFlex 25K (PRIMARY)
**Account facts (Lucid Trading):**
- Price ~$50 ($50.30 with fees on the order history). No activation fee.
- Eval target **$1,250**, **EOD trailing drawdown $1,000**, daily loss limit **$600**, **50% consistency** in eval, min 2 days.
- Funded: EOD trail $1,000 locks at **$26,100** (the buffer). Withdrawable = only balance above $26,100. **$26,600+ needed for the $500 min payout**; max payout **$1,000**; **5 green days** (≥$100) required; **90% split** → $900 net.
- After the 1st payout the cushion is **~$1,100** (balance ~$26,100, MLL locked at $25,100). No rebuild needed, just new green days + profit.
- Session opens **6:00 PM ET Sun–Thu**; **must be flat by 4:45 PM ET** (holidays earlier).
- Max 10 accounts / 5 funded. No microscalping (>50% of profit from <5 s holds), no HFT, no hedging. News allowed on Flex (but see red calendar).

**The plan (one trade per day, TP/SL set and never moved):**
| Phase | Trade | Approx. probability (50/50) |
|---|---|---|
| Eval | **Exactamente 2 trades de TP +$630 / SL −$600** (1 por día) = +$1,260 para pasar | ~49% per day; ~24% clean 2-day pass; **~38% pass** with recovery |
| Funded, first trade | **TP +$1,600 / SL −$600** (one shot) | **~27%** |
| Funded, after the hit | **4 small green days, ±$100–150** (with a stop, never no-stop) | ~99% |
| Payout | Withdraw up to $1,000 → $900 net | — |
| Later payouts | Rebuild ~$1,000 above the buffer with ±$600 then ±$100 days | ~50% each |

**Sizing:** eval up to 20 micros (2 minis); funded starts ~10 micros until ~$1k profit. Size each day so the SL fits the remaining room.

**Risk rules:**
- Max **−$600** on day 1. After a losing day, the next stop is **≤ ~$400** (sized to remaining room).
- **Never repeat the +$1,600 trade after missing it**; use a sized recovery trade instead.
- If room left is ~$100, **SKIP** the day.
- Don't trade after a payout request if it could underfund the account.
- **Cool-down 3–5 days** after losing multiple funded accounts. No revenge trading.

## 3. Strategy #2 — LucidDaily 25K (OPTIONAL side rail)
- Eval ~+$1,250/−$1,000 with 50% consistency. Funded drawdown is **intraday** (live + open P&L) until the $26,100 lock; news = hard breach; **no 5-green-day rule, no fixed max payout** (withdraw everything above $26,100, min $500).
- Plan: fixed **+$630/−$600** brackets, **always 2 minis / 20 micros**. **Never use the +$1,600 trade on Daily.**
- After a −$600 day, next SL ≤ ~$400. 2 wins ≈ $26,200 locks the MLL at $25,100.
- Funded run rule: **hard +$600 TP until the $26,100 lock**, then a secured +$600 SL and let it run.
- Targets: Meta A $26,600 → $500; Meta B $27,100 → ~$1,000; Meta C $28,000 → $1,900 requested (~$1,710 net).

## 4. Red calendar (both strategies)
**Sit flat** on **FOMC, CPI, NFP days and NQ/ES rollover weeks**. Never take the +$1,600 into those. (Learned the hard way: the user lost 3 funded accounts in a mid-September FOMC + rollover week.)

## 5. Markets
NQ / ES futures (minis or micros: MNQ $2/point, MES) on Lucid (Tradovate/NinjaTrader "TDV/NT"). There is no specific chart timeframe or entry signal; the method is about **bracket sizing to the account rules**.

---

## 6. The numbers (calculator = source of truth)
**Calculator:** traderestadistico.com/calculadora, preset "⭐ LucidFlex 25K — $50" (live version as of Oct 2026):
- Eval pass **38.4%** → 1st payout **27.4%** (goal $2,000 = +$1,600 then 4×$100) → 2nd **50%** → 3rd **50%**. The 2nd/3rd buffer is derived as goal − payout = $1,000.
- Of 100 accounts: ~38 pass, **~10.5 get paid once**, ~5 twice, ~2.6 three times.
- Breakdown: 10.54%×$900 = $94.86 + 5.27%×$900 = $47.43 + 2.64%×$900 = $23.72 → **$165.95 gross**.
- **Esperanza matemática = +$116 net per $50 account** (+232%; ≈$3.32 back per $1).
- With a 1:1 ±$600 eval: 38.0% pass, $164 gross, +$114 net. (A "44% pass" figure is NOT supported by the calculator.)
- **Old figures, now superseded:** $139 gross / +$89 net / 52% later payouts / $2.78 per $1 (the presentation page still shows these and should be updated). ~$146 / +$96 was the $1,100-buffer version.

**Raffle comparison (used in class):** 5-digit raffle (1 in 100,000), $1 ticket, $50,000 prize → E = 50,000/100,000 − $1 = **−$0.50 per ticket** (you get back $0.50 per $1). Strategy: +$116 per $50. *"La mayoría pierde en los dos… pero solo una gana en promedio."* For beginners, the **casino analogy** works better than the raffle: *"El casino pierde manos, pero nunca quiebra porque tiene la esperanza matemática a su favor."*

**Student liner (older teach-rounded version):** min ticket 20% to win $500: 5×$50 = $250 → ~$500 back (2×). Max ticket 15% to win $1,000: 7×$50 = $350 → ~$1,000 back (≈3×).

---

## 7. Firm comparisons already done (verdicts)
- **Lucid Pro 25K:** 40% funded consistency every cycle kills the one-shot +$1,600 day → stay on Flex.
- **Sure Leverage Funding:** CFDs on MT5/TradeLocker (not real futures), pricier ($135 eval / $381 instant for 25K), negative EV for the one-shot; One Step Pro 40% consistency → no.
- **Apex 25K Intraday ($10 promo + $79 activation only if you pass):** ~25% pass, 18% 1st payout, net ~+$48 (vs Lucid then ~+$96); intraday trail turns all-in stops into trailing stops; cost per first payout ~$670 vs ~$550. Lucid wins. Apex 25K EOD was noted as the closest "statistical twin" with funded-consistency adaptations.
- **MyFundedFutures Rapid EOD 25K:** good method match (EOD, no consistency, $1,100 buffer); max 3 funded seats.
- **Propfirmmatch scan (Oct 8, 2026, 108 accounts):** on paper, 44 beat Lucid Flex 25K's +$116 per account (mostly 50K accounts) and 13 beat it per $1. The top was Ylos Standard (90% off promo).
- **Ylos Standard 50K deep model (real rules):** $18 + $59 activation, target $3,000, $2,500 EOD eval DD; funded **trails tick-by-tick** until +$2,600 then locks at $50,100; **10 trading days with 7 winning days ≥$50**; **40% consistency**; median rule (max loss ≤5× median win); $500–$2,000 payouts; 100% of first $15k. Best plan is equal days of +$400/−$250 → ~**+$167 net** (3 payouts), but **~54 trading days to the 1st payout** (vs Lucid ~16), the +$1,600 day is forbidden, the edge depends on the promo (80% off → +$149) and on trading micros. **Verdict: Lucid Flex remains the best fit for this method.**

---

## 8. User's actual track record (as of Oct 12, 2026)
- 13 Lucid accounts bought (10 Flex at $50.30, 3 Daily at $55 / $68.20 / $88.20) = **$714.40 spent**.
- **5 funded** → pass rate **38.5%** (matches the model's 38%). **0 payouts collected**; all 5 funded accounts breached.
- Cost per funded account ~$143. **One Flex payout (~$900) covers everything spent.**
- 0 of 5 funded paying happens ~21% of the time (0.73^5): bad but plausible variance. Still review whether any breach broke a rule (red day, oversizing, repeating the big trade).
- A local HTML dashboard tracks this (accounts, pass rate, spend, payouts, break-even).
- Note: there is **no price backtest** and no audited P&L. All percentages are model estimates.

---

## 9. Content & course work
- **Student slide deck** "¿Rifa o estrategia? La esperanza matemática" (10 slides). Pending: update slides 6–9 to $166 / +$116 / 50% / $3.32 per $1.
- **YouTube / reels:** use "esperanza matemática", casino analogy, "cada cuenta es un boleto de $50", +$116 per account as a model estimate. No "millonario" claims as real results (payouts are capped ~$1,000/account), only clearly marked dramatization.
- **Course VSL ("Trader Estadístico"):** adapted from an AI-business VSL template (hook → problem/solution → 3 pillars: La Matemática, El Método, La Disciplina + calculator + community → epiphany → social proof → offer → CTA to book a call; plus post-booking video). **No income promises; a [7/14]-day course-satisfaction guarantee instead of a results refund**; disclaimer "El trading implica riesgo de pérdida."
- **Keep for the course, not public videos:** exact TP/SL numbers, the funnel percentages, the red calendar, Lucid-specific rule details.

## 10. Deferred ideas
- **TradingView Pine v5 "Lucid Flex Trade del Día"** indicator: manual account-state inputs → outputs the day's TP / SL / SKIP from the rules above. Pine can't read Lucid or place orders. Planned only; **don't code until asked.**
- The user also thought about bots/trade copiers. The user runs them; the AI only designs entry rules.

---
**Golden rules summary:** one trade a day · TP/SL fixed, never moved · eval +$630/−$600 · funded +$1,600/−$600 once, then small greens with stops · never repeat the big trade after a miss · size stops to remaining room · flat on FOMC/CPI/NFP/rollover · cool down after losses · no hedging · many accounts, not one · *Basado en matemática estadística.*
