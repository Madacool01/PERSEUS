# Open-Source Adaptive Strength Coach

## Product Concept & Project Brief

**Status:** Concept defined through product-discovery interview  
**Working title:** Open-Source Adaptive Strength Coach  
**Product category:** AI coaching, strength training, and workout analytics  
**Primary platform:** Desktop/web dashboard with basic phone-accessible workout logging

---

## 1. Executive Summary

The project is an **open-source, AI-powered strength-training coach** that adapts an existing workout program based on the user's actual performance and subjective recovery feedback.

Rather than merely recording workouts or generating a generic routine, the product acts as an **autonomous adaptive coach**. It evaluates every set, monitors how workouts and recovery feel, and decides how the program should evolve. It can adjust exercise selection, load, repetitions, set volume, intensity, deloads, and longer training blocks.

The product is intended for **lifters of all experience levels** and should work with **any equipment configuration**, from a limited home gym to a fully equipped commercial gym.

Its defining characteristic is **proactive intelligence**: it should identify useful patterns and intervene at the right time without forcing the user to prompt it for every recommendation. Interventions should remain selective and valuable rather than becoming noisy or distracting.

---

## 2. How the Idea Evolved

The initial goal was to identify a popular premium software category that could be reimagined as an open-source product—not as a direct copy, but as an independently designed alternative with a distinct implementation and product identity.

The areas of strongest interest were:

- Developer tools and AI
- Productivity and knowledge management
- Health, fitness, and wellness

The broader initial vision was a **personal AI Life Operating System** for people who want to supercharge their lives with AI. That system would potentially combine:

- A personal dashboard
- Intelligent journaling
- Goal and progress tracking
- Pattern recognition
- Recommendations and coaching
- Long-term personalization
- Proactive intervention

Within that broad vision, the most compelling concrete use case emerged as **AI coaching for strength training**—specifically, helping users decide how to progressively overload exercises and providing recommendations based on how their workouts and recovery feel.

This narrower product is more focused and practical than a general-purpose Life OS while retaining the original qualities that made that idea appealing: personalization, memory, reflection, pattern recognition, and proactive coaching.

---

## 3. Product Vision

> Build an open-source strength coach that understands a lifter's program, performance, effort, and recovery—and continuously adapts their training to support safe, sustainable progress.

The app should feel less like a static workout tracker and more like a knowledgeable coach reviewing every session. It should understand what the user planned, what they actually completed, how difficult each set felt, and how well they are recovering.

Its job is to answer questions such as:

- Should the user add weight next session?
- Should they add repetitions before increasing weight?
- Is the current volume productive or excessive?
- Was a poor session an isolated event or evidence of accumulated fatigue?
- Should an exercise be maintained, progressed, regressed, or replaced?
- Is a deload appropriate?
- Should the next training block emphasize a different rep range, movement, or progression strategy?

---

## 4. Target Audience

### Primary audience

**People who strength train at any experience level and want intelligent, individualized programming decisions.**

This includes:

- Beginners who need clear and conservative progression
- Intermediate lifters who understand the basics but want better progression and fatigue decisions
- Advanced lifters who benefit from deeper analytics, periodization, and fatigue management
- Home-gym users with limited equipment
- Commercial-gym users with access to many exercise variations
- Developers, technical professionals, and AI enthusiasts interested in data-driven self-improvement
- People who want to use AI to improve their daily lives and performance

### Adaptive coaching depth

The app should not deliver the same amount of complexity to every user. Coaching should adapt to training experience:

- **Beginners:** simpler explanations, conservative changes, fewer variables, and clear technique or safety reminders
- **Intermediate lifters:** more nuanced load, repetition, volume, and recovery recommendations
- **Advanced lifters:** optional detailed analysis involving fatigue trends, training blocks, volume distribution, and progression strategy

---

## 5. Core User Need

The central problem is not creating a workout plan from nothing. The user already has an initial plan.

The primary need is:

> “Given my existing workout plan, what should I change next—and why—based on how I performed and how the training felt?”

Traditional workout trackers collect data but leave the programming decisions to the user. Generic AI chatbots can suggest changes but often lack persistent, structured workout context. Fixed training programs prescribe progression but cannot adequately respond to daily performance, soreness, pain, poor sleep, motivation, or equipment constraints.

This product should connect those missing pieces.

---

## 6. Core Product Principles

### 6.1 Adapt an existing plan before replacing it

The product should respect the user's current program. It should begin by understanding and monitoring that plan rather than immediately generating an entirely new routine.

Program changes should be purposeful and explainable.

### 6.2 Use both objective and subjective data

Numbers such as weight, repetitions, and completed sets do not tell the whole story. The coaching engine should also consider effort and recovery feedback.

### 6.3 Be proactive, but not noisy

The coach should intervene when it detects something important, including stalled progress, unusual fatigue, repeated missed targets, or a meaningful opportunity to progress.

It should avoid producing generic commentary after every action.

### 6.4 Increase autonomy through trust

The broader Life OS concept favored adaptive autonomy: begin cautiously and become more proactive as the user grants trust and permissions.

For this product, users should be able to review what the system changed, understand why it changed it, and determine how much autonomy it has. Although the selected long-term mode is full adaptive programming, transparency and user override should remain fundamental.

### 6.5 Remain equipment-flexible

The system should represent exercises by movement and training purpose rather than treating exercise names as isolated labels. This allows it to suggest viable substitutions based on the equipment a user actually has.

### 6.6 Support all levels without overwhelming users

Complexity should be progressive. Advanced controls and analytics can be available without making the basic workflow difficult.

---

## 7. User Input and Data Collection

### 7.1 Initial program entry

The selected first method is a **manual workout builder**.

Users should be able to enter:

- Training days or sessions
- Exercises
- Exercise order
- Sets
- Rep targets or rep ranges
- Initial working loads
- Rest targets, if relevant
- Frequency or weekly schedule
- Optional notes and progression preferences

The first version does not need to prioritize AI program generation, spreadsheet import, screenshot extraction, or third-party app migration.

### 7.2 Per-set workout feedback

The user wants **per-set feedback**, not just a single rating for the entire session.

Each working set can include:

- Exercise
- Weight or resistance
- Completed repetitions
- Target repetitions
- RPE, RIR, or another perceived-effort measure
- Whether the set was completed as planned
- Optional set note

The product should define RPE/RIR clearly and use a consistent internal representation.

### 7.3 Recovery and readiness feedback

The user also wants detailed context beyond per-set data, including:

- Muscle soreness
- Pain or discomfort
- Sleep quality
- Energy
- Motivation
- General recovery
- How the workout felt overall

To reduce logging fatigue, this can become **adaptive** in practice: collect essential information consistently, then ask targeted follow-up questions when the data suggests that additional context is needed.

### 7.4 Journaling and reflection

The broader concept included intelligent journaling. In the strength-coaching product, this can appear as workout notes, recovery reflections, or free-text check-ins.

The AI should be able to:

- Find recurring patterns
- Infer progress
- Recommend improvements
- Identify contradictions or avoidance
- Convert reflections into practical program changes
- Connect qualitative feedback to workout outcomes

---

## 8. Coaching Responsibilities

The selected target is **full adaptive programming**.

The coaching system should eventually be able to manage:

### Session-level decisions

- Recommend or apply load changes
- Adjust rep targets
- Add or remove sets
- Modify the day's intensity
- Account for readiness and pain feedback
- Substitute an exercise when equipment is unavailable or a movement is unsuitable

### Week-to-week decisions

- Progress or regress exercises
- Update weekly volume
- Change frequency or exercise distribution where justified
- Detect stalled lifts
- Distinguish a bad day from an emerging trend
- Manage accumulated fatigue

### Block-level decisions

- Create or modify training blocks
- Change rep ranges or emphasis
- Schedule deloads
- Rotate exercise variations
- Rebalance muscle-group or movement-pattern volume
- Evaluate whether a progression model is working

### Coaching and explanation

- Explain what changed
- Explain which observations caused the change
- State the expected benefit
- Communicate uncertainty
- Offer a user override
- Track whether the adjustment worked

---

## 9. Progressive Overload Engine

The heart of the product is a rules-and-AI system for progressive overload.

Potential progression actions include:

- Increase weight
- Increase repetitions within a target range
- Increase sets
- Improve execution at the same load and volume
- Reduce assistance on an assisted movement
- Increase range of motion or movement difficulty
- Maintain the current prescription while consolidating performance
- Reduce load or volume to manage fatigue
- Deload
- Substitute an exercise

The engine should avoid treating “add weight every session” as the only form of progression.

### Example decision factors

A recommendation can consider:

- Whether all target sets and reps were completed
- Per-set RPE or RIR
- Whether effort rises unexpectedly across sets
- Recent performance history for the exercise
- Repeated failure at the same load
- Sleep, energy, soreness, and motivation
- Pain reports
- Time since the last progression
- Exercise type and sensible load increments
- User experience level
- Available equipment and minimum weight increments
- Current training-block goals

### Example behavior

If a user completes all prescribed sets at the top of a rep range with more repetitions in reserve than expected, the system might recommend a small load increase.

If the user misses targets after poor sleep on one isolated day, the system might preserve the plan rather than immediately regressing it.

If performance falls across multiple sessions while soreness and perceived effort remain elevated, the system might reduce volume or initiate a deload.

If pain is reported, the system should avoid aggressively progressing the affected movement and should present conservative options, while clearly distinguishing general training guidance from medical advice.

---

## 10. Proactive Intelligence

Proactivity was selected as the main differentiator.

The system should intervene at useful moments, including:

- Before a workout, when readiness suggests the planned session may need adjustment
- During a workout, when actual performance differs significantly from the prescription
- After a workout, when set-level feedback reveals a progression or recovery issue
- When it detects procrastination, repeated skipped sessions, or stalled goals
- During evening or post-session reflection
- During weekly reviews
- During monthly or training-block reviews

The preferred behavior is to support **all of these intervention points**, but only when the insight is genuinely valuable.

### Good proactive messages

- “You reached the top of the rep range in all three sets with approximately three reps in reserve. I increased next week's load by 2.5 kg.”
- “Your last two squat sessions were harder despite unchanged load, and soreness has remained elevated. I recommend removing one set this week rather than reducing the load.”
- “Today's poor result follows one night of low sleep but not a broader downward trend. I have left next week's prescription unchanged.”

### Poor proactive messages

- Generic encouragement after every set
- Repeating statistics visible on the dashboard
- Making large changes based on one unusual workout
- Presenting confident conclusions when data is insufficient
- Sending frequent alerts that do not require action

---

## 11. Primary Product Experience

### Selected platform

The primary product experience should be a **desktop/web dashboard**, emphasizing planning and analytics while still supporting basic phone logging.

This differs from a mobile-first workout tracker. The main value is expected to come from understanding the program, reviewing trends, and seeing why the AI made changes.

### Dashboard concept

The earlier Life OS vision favored both a personal dashboard and intelligent journaling. Those concepts can be translated into a training-focused command center containing:

- Current training plan
- Upcoming workouts
- Completed workout history
- Per-exercise progression
- Volume and performance trends
- Recovery trends
- AI coaching recommendations
- Recent program adjustments
- Workout reflections and notes
- Alerts requiring user attention

The exact dashboard priority was not finalized. A reasonable direction is a unified experience combining the program editor, analytics, coaching feed, calendar, and history, while keeping the initial implementation focused.

### Phone use

Although desktop/web is primary, workouts often occur away from a desktop. The web application should therefore be responsive enough to support basic phone-based set logging. A native mobile app is not part of the initial decision.

---

## 12. AI Behavior and Memory

The broader personal-agent concept established several relevant preferences:

- The AI should understand the user over time.
- It should find patterns across structured data and written reflections.
- It should initiate useful coaching rather than wait for every prompt.
- Its level of autonomy should adapt as trust develops.

For the strength coach, long-term memory should include:

- Current and historical programs
- Exercise performance
- Typical RPE/RIR patterns
- Recovery trends
- Equipment availability
- Exercise preferences
- Exercise substitutions that worked or failed
- Pain or limitation history entered by the user
- User goals
- Previous coaching decisions and their outcomes

The AI should retrieve relevant history when making a decision rather than relying only on the most recent workout.

---

## 13. Open-Source Positioning

The product should be an original open-source alternative in the premium AI coaching and adaptive fitness-software category.

### Potential open-source advantages

- Transparent progression logic
- Auditable coaching decisions
- User control over workout history and personal data
- Extensible progression strategies
- Community-created exercise libraries and training methodologies
- Self-hosting as a future option
- Integration with local or user-selected AI models
- No permanent lock-in to a proprietary workout platform

### Product differentiation

The primary selected differentiator is **proactive intelligence**, supported by:

- Detailed per-set effort feedback
- Recovery context
- Full program adaptation
- Long-term trend recognition
- Equipment flexibility
- Experience-aware coaching depth
- An explanation of why each adjustment was made

The product should not reproduce another company's branding, copyrighted assets, proprietary text, or source code. It should solve the same broad user problem through an independent design and implementation.

---

## 14. Suggested Initial Product Scope

The discussion deliberately stopped before fully specifying the software. Based on the decisions made, a focused first version could include:

1. User account or local profile
2. Manual workout-program builder
3. Exercise and equipment configuration
4. Responsive workout logger
5. Per-set weight, reps, and RPE/RIR logging
6. Post-workout recovery and reflection form
7. Exercise history and basic trend charts
8. An adaptive recommendation engine for the next session
9. A coaching feed explaining recommended changes
10. User approval, rejection, and override of changes

### Sensible first progression strategy

For the earliest version, deterministic progression rules can provide the safety-critical foundation, while an AI model:

- Interprets free-text feedback
- Summarizes trends
- Explains recommendations
- Asks targeted follow-up questions
- Helps select among bounded, valid adjustments

This hybrid design would be more predictable and testable than allowing a language model to freely rewrite programs from the beginning.

---

## 15. Potential Future Capabilities

These were not selected as immediate requirements but follow naturally from the concept:

- AI generation of new programs
- Proven expert templates
- Spreadsheet, text, image, and third-party app import
- Native iOS and Android apps
- Wearable and health-platform integration
- Automated readiness estimates
- Coach/client accounts
- Collaborative program review
- Community-created coaching strategies
- Local AI inference
- Self-hosted deployments
- Broader habit, nutrition, sleep, or Life OS modules

The original Life OS idea could eventually become a broader platform, with strength coaching serving as the first focused and defensible vertical.

---

## 16. Safety and Trust Requirements

Because the app makes health-adjacent training recommendations, safety should be a product requirement rather than only a disclaimer.

The system should:

- Avoid diagnosing injuries or medical conditions
- Treat pain differently from ordinary effort or soreness
- Recommend conservative action when pain or unusual symptoms are reported
- Encourage qualified professional or medical help when appropriate
- Avoid aggressive progression when data is incomplete
- Clearly indicate uncertainty
- Preserve a history of program changes
- Allow users to undo AI changes
- Explain the evidence behind material adjustments
- Avoid implying that AI-generated guidance guarantees safety or results

---

## 17. Success Criteria

The project is successful if users can:

1. Enter an existing training plan without excessive setup.
2. Log every working set quickly and consistently.
3. Record effort and recovery in a way that does not become burdensome.
4. Receive a useful next-session recommendation without composing a prompt.
5. Understand why a change was suggested or applied.
6. See that the system responds differently to isolated bad days and persistent trends.
7. Use the product with different equipment and at different experience levels.
8. Maintain control over automated program changes.
9. Observe sustainable progression over time.

Potential product metrics include:

- Workout logging completion rate
- Recommendation acceptance and override rates
- Frequency of unexplained or reversed changes
- User-reported usefulness of proactive interventions
- Program adherence
- Rate of successful progression after recommendations
- Retention across a complete training block

---

## 18. Decisions Already Made

| Area | Decision |
|---|---|
| Broad interests | Developer tools and AI; productivity and knowledge; health and fitness |
| Broader audience | Individual developers and people who want to supercharge their lives with AI |
| Initial broad concept | Personal AI Life Operating System |
| Broad experience | Personal dashboard plus intelligent journaling |
| Broad AI behavior | Pattern detection, progress tracking, recommendations, challenge, and planning |
| Autonomy philosophy | Adaptive; become more proactive as trust and permissions grow |
| Main differentiator | Proactive intelligence |
| Selected vertical | AI coaching |
| Specific use case | Adaptive progressive-overload and workout coaching |
| Lifter level | All experience levels |
| Equipment | Flexible; adapt to available equipment |
| Program starting point | User already has a plan |
| Initial plan input | Manual workout builder |
| Workout feedback | Per-set feedback, including RPE/RIR |
| Recovery context | Soreness, pain, sleep, energy, motivation, and general recovery |
| AI control | Full adaptive programming |
| AI responsibilities | Exercises, volume, intensity, progression, deloads, and training blocks |
| Intervention timing | Throughout the training cycle, but only when genuinely useful |
| Primary platform | Desktop/web dashboard with basic phone logging |
| Open-source intent | Original open-source alternative to premium adaptive coaching software |

---

## 19. Open Product Questions

These details were intentionally not finalized and can be addressed during product design:

- The initial training goal to optimize for: strength, hypertrophy, general fitness, or multiple modes
- Whether the system applies changes automatically or presents them for approval by default
- Exact progression algorithms for different exercise types
- How RPE and RIR should be normalized
- The minimum data required before the system makes larger adjustments
- How training blocks and deloads should be represented
- Whether the first release uses hosted AI, local models, or both
- Account, privacy, synchronization, and self-hosting architecture
- The exact balance between deterministic rules and model-driven decisions
- The main dashboard hierarchy
- Monetization, if a hosted version is eventually offered
- Project name and brand identity

---

## 20. Concise Product Pitch

> An open-source adaptive strength coach that takes your existing program, learns from every set and recovery check-in, and proactively adjusts load, reps, volume, exercises, deloads, and training blocks—while explaining why each change should help.
