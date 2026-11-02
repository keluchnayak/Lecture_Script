export interface SampleTranscript {
  id: string;
  title: string;
  subject: string;
  duration: string;
  wordCount: number;
  preview: string;
  transcript: string;
}

export const SAMPLE_TRANSCRIPTS: SampleTranscript[] = [
  {
    id: 'cs-distributed-systems',
    title: 'Distributed Systems & Client-Server Architecture',
    subject: 'Computer Science & Engineering',
    duration: '~2 Hours Class',
    wordCount: 1420,
    preview: 'Covers decoupled client-server models, RPCs, stateful vs stateless protocols, Amdahl’s law, and network latency pitfalls.',
    transcript: `[00:00:15] Professor: All right, good morning everyone. Can everyone in the back hear me? Rahul, please mute your microphone, there is an echo coming through. Great. Today is lecture 14 of CS 401, Distributed Systems and Scalable Architecture. Today's class will run for the full two hours, and we have a lot of ground to cover.

[00:03:20] Professor: Now before we begin, remember your midterms are in three weeks. And mark my words: today's topic on the CAP Theorem and Idempotency in REST APIs is guaranteed to be on the midterm exam. Make a big note of that in your notebook right now. Every single semester, at least 40% of students lose points on the definition of idempotency. Do not be that student!

[00:06:45] Professor: Let's start with the fundamental paradigm: Client-Server Architecture. What does it actually mean? At its core, we decouple presentation and UI state—which runs on the client device, such as a browser running React.js or a mobile app—from the business logic and shared data storage running on the server, typically built with Node.js, Go, or Python.

[00:12:10] Professor: Why do we decouple this? Three reasons. First: Separation of concerns. The frontend engineer focuses on user experience, responsive viewports, and instantaneous client interactions. The backend engineer focuses on concurrency, atomicity, transactions, and security. Second: Centralized security and access control. You can NEVER trust the client. Any JavaScript running in the browser can be modified by the user using DevTools. So all authorization checks must be enforced strictly on the server side. Third: Scalability. We can scale our stateless backend horizontally behind a load balancer without needing to change anything on the client side.

[00:25:30] Professor: Let's draw a diagram on the blackboard. Please draw this in your notebook. On the left side, draw a box labeled 'Client (React SPA)'. In the middle, draw another box labeled 'API Gateway / Express Server'. On the right side, draw a cylinder labeled 'Database (PostgreSQL / MongoDB)'. Now draw an arrow from Client to Server labeled 'HTTP POST /api/data with JSON Payload'. Draw an arrow from Server to Database labeled 'SQL Query / Connection Pool'. Then draw return arrows with the response status code 200 OK and JSON data.

[00:38:15] Professor: Now let's talk about Latency and the Speed of Light. A lot of junior engineers think network calls are instantaneous. They are not! In local memory (L1 cache), an access takes about 1 nanosecond. Main RAM takes about 100 nanoseconds. But a roundtrip network packet between New York and London takes 70 to 80 milliseconds! That is nearly a million times slower. Keep that order of magnitude in your head.

[00:52:40] Professor: Let's examine Amdahl's Law. You need to write this formula down. The formula is: S_latency(s) = 1 / ((1 - p) + (p / s)). Where S is the overall theoretical speedup, p is the fraction of execution time that can be improved or parallelized, and s is the speedup factor of that specific improved part. Notice that if only 50% of your backend task can be parallelized, even if you buy an infinite number of CPU cores (s = infinity), your maximum possible speedup can never exceed 2x! That is a classic trap in system design.

[01:10:00] Professor: Alright, let's take a quick 3-minute breather while I wipe the board. Don't leave your seats... Okay, we are back. Now let's dive into Idempotency. What does idempotent mean? In mathematics, an operation is idempotent if applying it multiple times produces the exact same result as applying it once: f(f(x)) = f(x). In HTTP and REST: GET is idempotent. If you fetch a user profile 10 times, the database state does not change. PUT is idempotent. If you overwrite user #42's email to 'john@test.com' five times, the end state is identical. DELETE is idempotent. Deleting resource #99 once or multiple times leaves it deleted. BUT POST is NOT idempotent! If you call POST /api/orders five times during a network retry timeout, you will charge the customer's credit card five times and create five separate duplicate orders! This is why idempotency keys (UUIDs in the request headers) are mandatory in modern financial systems.

[01:34:20] Professor: Let's talk about the Event Loop in Node.js. Node is single-threaded for JavaScript execution, but uses libuv underneath for non-blocking asynchronous I/O. The event loop phases are: Timers (setTimeout, setInterval), Pending Callbacks (I/O callbacks), Poll phase (retrieves new I/O events), Check phase (setImmediate), and Close Callbacks (socket.on('close')). If you execute a heavy CPU calculation—like computing prime numbers or training machine learning weights—inside the main thread, you will block the entire event loop, and all other incoming requests will hang! Always offload heavy compute to worker threads or external microservices.

[01:52:10] Professor: To summarize today's two hours: We decoupled frontend and backend, understood why the client is untrusted, drew the three-tier architecture diagram, derived Amdahl's Law for scaling limits, defined why POST is non-idempotent whereas GET/PUT/DELETE are idempotent, and walked through the Node.js libuv event loop. Next Tuesday, we will discuss database sharding and replica sets. Please read chapter 4 of the textbook. Class dismissed!`,
  },
  {
    id: 'chem-organic-reactions',
    title: 'Organic Chemistry: SN1 vs SN2 Reaction Mechanisms',
    subject: 'Organic Chemistry & Biochemistry',
    duration: '~90 Mins Class',
    wordCount: 1150,
    preview: 'Detailed walkthrough of nucleophilic substitution, carbocation stability, steric hindrance, solvent effects (polar protic vs aprotic), and stereochemical inversion.',
    transcript: `[00:00:10] Professor: Welcome back everyone. Settle down please. Today we are tackling one of the most critical topics in organic chemistry: Nucleophilic Substitution Mechanisms, specifically SN1 versus SN2. 

[00:04:30] Professor: Let's make an exam alert right away. Every single organic chemistry exam, whether it's MCAT, university finals, or AP Chem, has at least 3 questions testing your ability to predict whether a reaction proceeds via SN1 or SN2. If you master the four diagnostic factors we cover today, you will get 100% on those questions.

[00:11:00] Professor: Factor 1: The Substrate and Steric Hindrance. Let's look at SN2 first. The '2' stands for bimolecular—meaning the rate-determining step involves both the nucleophile and the alkyl halide substrate. Rate = k[substrate][nucleophile]. Because the nucleophile must attack from the backside (180 degrees opposite the leaving group), it needs physical space. Therefore, substrate reactivity for SN2 is: Methyl > Primary (1°) > Secondary (2°) >>> Tertiary (3°). In fact, tertiary alkyl halides do NOT undergo SN2 at all because the bulky methyl groups physically block the incoming nucleophile!

[00:24:15] Professor: In your notebook, please draw the Walden Inversion transition state. Draw a central carbon with a dashed line going to the incoming nucleophile on the left, and a dashed line going to the exiting halide leaving group on the right. Note that this is a pentacoordinate transition state. The three other substituents flip inside out like an umbrella in a hurricane! This produces a 100% stereochemical inversion of configuration (R goes to S, or S goes to R).

[00:39:00] Professor: Now let's contrast that with SN1. The '1' stands for unimolecular. Rate = k[substrate]. The nucleophile is NOT in the rate equation! Why? Because step 1 is the slow, rate-determining departure of the leaving group to form an intermediate carbocation. Because carbocations are stabilized by hyperconjugation and inductive electron donation from neighboring alkyl groups, substrate reactivity for SN1 is the exact REVERSE: Tertiary (3°) > Secondary (2°) >>> Primary (1°) > Methyl. Tertiary carbocations are planar, sp2 hybridized.

[00:55:20] Professor: What about stereochemistry in SN1? Because the carbocation intermediate is flat and planar (trigonal planar), the nucleophile can attack equally from the top face or bottom face with 50/50 probability. This yields a racemic mixture (optically inactive 50:50 enantiomer pair). Note this in your margin: SN2 causes stereochemical inversion; SN1 causes racemization!

[01:12:00] Professor: Factor 2: The Solvent. This is where students always get confused. For SN2, you want Polar Aprotic solvents—such as Acetone, DMSO (dimethyl sulfoxide), and DMF. Why aprotic? Because they solvate cations well, leaving the nucleophile 'naked' and highly reactive. For SN1, you want Polar Protic solvents—like water, methanol, ethanol. Protic solvents have hydrogen-bonding O-H or N-H bonds that stabilize both the carbocation and the departing halide anion.

[01:25:00] Professor: Factor 3: Nucleophile strength. Strong nucleophiles (like OH-, CN-, I-, RS-) force the bimolecular SN2 pathway. Weak nucleophiles (like H2O, ROH) patiently wait for the carbocation to form, favoring SN1.

[01:28:40] Professor: Let's summarize the decision flowchart for your notebook:
Step 1: Check substrate. If methyl or 1° -> Definitely SN2. If 3° -> Definitely SN1 (or E1/E2). If 2° -> Check solvent and nucleophile.
Step 2: If 2° with strong nucleophile in polar aprotic solvent -> SN2.
Step 3: If 2° with weak nucleophile in polar protic solvent -> SN1.
Copy this 3-step decision tree at the bottom of your page. See you on Thursday for Elimination reactions!`,
  },
];
