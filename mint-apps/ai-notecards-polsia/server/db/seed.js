import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getMigrationConfig } from './runtime.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../.env') });

function seededUuid(group, index) {
  const suffix = ((BigInt(group) << 40n) + BigInt(index)).toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${suffix}`;
}

const categories = [
  ['Science', 'science'],
  ['Mathematics', 'mathematics'],
  ['History', 'history'],
  ['Languages', 'languages'],
  ['Literature', 'literature'],
  ['Computer Science', 'computer-science'],
  ['Business', 'business'],
  ['Medical & Health', 'medical-health'],
  ['Psychology', 'psychology'],
  ['Arts & Music', 'arts-music'],
  ['Law', 'law'],
  ['Engineering', 'engineering'],
  ['Test Prep', 'test-prep'],
].map(([name, slug], index) => ({
  id: seededUuid(10, index + 1),
  name,
  slug,
  sortOrder: index + 1,
}));

const users = [
  {
    id: seededUuid(20, 1),
    email: 'maya.chen@example.com',
    displayName: 'Maya Chen',
    plan: 'pro',
    role: 'user',
    studyScore: 412,
    seller: true,
  },
  {
    id: seededUuid(20, 2),
    email: 'luis.romero@example.com',
    displayName: 'Luis Romero',
    plan: 'pro',
    role: 'user',
    studyScore: 389,
    seller: true,
  },
  {
    id: seededUuid(20, 3),
    email: 'nina.patel@example.com',
    displayName: 'Nina Patel',
    plan: 'pro',
    role: 'user',
    studyScore: 431,
    seller: true,
  },
  {
    id: seededUuid(20, 4),
    email: 'owen.brooks@example.com',
    displayName: 'Owen Brooks',
    plan: 'pro',
    role: 'user',
    studyScore: 367,
    seller: true,
  },
  {
    id: seededUuid(20, 5),
    email: 'ava.nguyen@example.com',
    displayName: 'Ava Nguyen',
    plan: 'trial',
    role: 'user',
    studyScore: 148,
    seller: false,
  },
  {
    id: seededUuid(20, 6),
    email: 'jordan.ellis@example.com',
    displayName: 'Jordan Ellis',
    plan: 'free',
    role: 'user',
    studyScore: 172,
    seller: false,
  },
  {
    id: seededUuid(20, 7),
    email: 'riley.kim@example.com',
    displayName: 'Riley Kim',
    plan: 'free',
    role: 'user',
    studyScore: 196,
    seller: false,
  },
  {
    id: seededUuid(20, 8),
    email: 'sofia.rivera@example.com',
    displayName: 'Sofia Rivera',
    plan: 'trial',
    role: 'user',
    studyScore: 204,
    seller: false,
  },
  {
    id: seededUuid(20, 9),
    email: 'ethan.wright@example.com',
    displayName: 'Ethan Wright',
    plan: 'free',
    role: 'user',
    studyScore: 138,
    seller: false,
  },
  {
    id: seededUuid(20, 10),
    email: 'zoe.carter@example.com',
    displayName: 'Zoe Carter',
    plan: 'free',
    role: 'user',
    studyScore: 221,
    seller: false,
  },
  {
    id: seededUuid(20, 11),
    email: 'isaac.morris@example.com',
    displayName: 'Isaac Morris',
    plan: 'trial',
    role: 'user',
    studyScore: 164,
    seller: false,
  },
  {
    id: seededUuid(20, 12),
    email: 'leah.turner@example.com',
    displayName: 'Leah Turner',
    plan: 'free',
    role: 'admin',
    studyScore: 257,
    seller: false,
  },
];

const decks = [
  ['AP Biology: Cells', 'science', 'maya.chen@example.com', 400, ['cell theory', 'organelles', 'membrane transport', 'cell cycle', 'enzymes', 'microscopy'], ['ap-bio', 'cells', 'science']],
  ['Chemistry: Bonding Basics', 'science', 'maya.chen@example.com', 300, ['ionic bonding', 'covalent bonding', 'polarity', 'electronegativity', 'molecular shape', 'intermolecular forces'], ['chemistry', 'bonding', 'high-school']],
  ['Algebra II Essentials', 'mathematics', 'maya.chen@example.com', 200, ['quadratic functions', 'factoring', 'complex numbers', 'exponents', 'logarithms', 'systems'], ['algebra', 'exam-review', 'math']],
  ['World History 1450-1750', 'history', 'luis.romero@example.com', 300, ['renaissance', 'reformation', 'mercantilism', 'columbian exchange', 'absolutism', 'scientific revolution'], ['history', 'world-history', 'timeline']],
  ['US Government Foundations', 'history', 'luis.romero@example.com', 200, ['federalism', 'checks and balances', 'bill of rights', 'judicial review', 'electoral college', 'bureaucracy'], ['civics', 'government', 'exam-review']],
  ['Spanish Travel Phrases', 'languages', 'luis.romero@example.com', 100, ['greetings', 'directions', 'ordering food', 'emergencies', 'transportation', 'numbers'], ['spanish', 'travel', 'beginner']],
  ['Python Interview Patterns', 'computer-science', 'nina.patel@example.com', 500, ['lists', 'dictionaries', 'recursion', 'time complexity', 'strings', 'testing'], ['python', 'coding-interview', 'backend']],
  ['System Design Flashcards', 'computer-science', 'nina.patel@example.com', 500, ['load balancer', 'caching', 'queues', 'database scaling', 'consistency', 'observability'], ['system-design', 'engineering', 'interviews']],
  ['Intro Financial Accounting', 'business', 'nina.patel@example.com', 300, ['assets', 'liabilities', 'equity', 'journal entry', 'income statement', 'cash flow'], ['accounting', 'business', 'college']],
  ['Anatomy: Major Body Systems', 'medical-health', 'owen.brooks@example.com', 400, ['circulatory system', 'respiratory system', 'digestive system', 'nervous system', 'muscular system', 'skeletal system'], ['anatomy', 'nursing', 'med-school']],
  ['Psychology Research Methods', 'psychology', 'owen.brooks@example.com', 300, ['independent variable', 'dependent variable', 'sampling bias', 'reliability', 'validity', 'ethics'], ['psychology', 'research', 'methods']],
  ['Music Theory Chords', 'arts-music', 'owen.brooks@example.com', 200, ['major triad', 'minor triad', 'seventh chord', 'cadence', 'scale degree', 'inversion'], ['music-theory', 'piano', 'chords']],
  ['Contracts Law Core Terms', 'law', 'maya.chen@example.com', 500, ['consideration', 'offer', 'acceptance', 'breach', 'damages', 'capacity'], ['law-school', 'contracts', '1l']],
  ['Statics Equations Review', 'engineering', 'owen.brooks@example.com', 400, ['free body diagram', 'moment', 'equilibrium', 'distributed load', 'shear force', 'truss'], ['engineering', 'statics', 'mechanics']],
  ['SAT Reading Strategies', 'test-prep', 'nina.patel@example.com', 200, ['main idea', 'evidence pair', 'tone', 'vocabulary in context', 'paired passages', 'timing'], ['sat', 'reading', 'test-prep']],
  ['Literary Devices Quick Review', 'literature', 'luis.romero@example.com', 100, ['metaphor', 'simile', 'imagery', 'irony', 'foreshadowing', 'allusion'], ['literature', 'english', 'essay']],
].map(([title, categorySlug, ownerEmail, priceCents, concepts, tags], index) => ({
  id: seededUuid(30, index + 1),
  listingId: seededUuid(40, index + 1),
  title,
  categorySlug,
  ownerEmail,
  priceCents,
  concepts,
  tags,
  sourceText: `${title} curated study notes for the Polsia handoff seed.`,
  description: `A curated deck covering ${concepts.slice(0, 3).join(', ')}, and more for quick review.`,
}));

function buildCards(deck) {
  const cards = [];

  for (const concept of deck.concepts) {
    cards.push({
      front: `What should you remember about ${concept}?`,
      back: `${concept} is one of the core ideas in ${deck.title}, and this card is designed for quick recall practice.`,
    });
    cards.push({
      front: `Why does ${concept} matter in ${deck.title}?`,
      back: `It anchors one of the recurring patterns learners see when reviewing ${deck.title}.`,
    });
  }

  return cards.slice(0, 10).map((card, index) => ({
    id: seededUuid(70 + decks.findIndex((candidate) => candidate.id === deck.id), index + 1),
    ...card,
    position: index,
  }));
}

function reviewTextForStars(stars, title) {
  if (stars >= 5) return `Clear, high-signal deck for ${title}.`;
  if (stars === 4) return `Helpful review set with a few cards I revisited twice.`;
  if (stars === 3) return `Solid overview, but I wanted a little more detail in places.`;
  if (stars === 2) return `Useful as a quick scan, though some cards felt too broad.`;
  return `Not the right fit for my study style, but the topic coverage is still there.`;
}

function createRatings() {
  const raters = users.filter((user) => !user.seller);
  const stars = [5, 4, 5, 3, 4, 2, 5, 1, 4, 5, 3, 4, 2, 5, 4, 3, 5, 4, 2, 4];
  const ratings = [];

  raters.forEach((rater, raterIndex) => {
    for (let offset = 0; offset < 5; offset += 1) {
      const listing = decks[(raterIndex * 2 + offset * 3) % decks.length];
      ratings.push({
        id: seededUuid(50, ratings.length + 1),
        userId: rater.id,
        listingId: listing.listingId,
        stars: stars[ratings.length % stars.length],
        reviewText: reviewTextForStars(stars[ratings.length % stars.length], listing.title),
      });
    }
  });

  return ratings.slice(0, 40);
}

const ratings = createRatings();
const reviewFlagRating = ratings.find((rating) => rating.listingId === decks[9].listingId);

const contentFlags = [
  {
    id: seededUuid(60, 1),
    listingId: decks[6].listingId,
    reporterId: users[4].id,
    reason: 'Low Quality',
    status: 'pending',
    flagType: 'listing',
    ratingId: null,
    adminNotes: null,
  },
  {
    id: seededUuid(60, 2),
    listingId: decks[2].listingId,
    reporterId: users[5].id,
    reason: 'Misleading',
    status: 'dismissed',
    flagType: 'listing',
    ratingId: null,
    adminNotes: 'Synthetic sample flag retained for handoff realism.',
  },
  {
    id: seededUuid(60, 3),
    listingId: decks[9].listingId,
    reporterId: users[6].id,
    reason: 'Other',
    status: 'upheld',
    flagType: 'review',
    ratingId: reviewFlagRating?.id || null,
    adminNotes: 'Synthetic review flag example.',
  },
  {
    id: seededUuid(60, 4),
    listingId: decks[13].listingId,
    reporterId: users[7].id,
    reason: 'Spam',
    status: 'pending',
    flagType: 'listing',
    ratingId: null,
    adminNotes: null,
  },
];

const deckStats = decks.map((deck, index) => ({
  id: seededUuid(80, index + 1),
  userId: users.find((user) => user.email === deck.ownerEmail).id,
  deckId: deck.id,
  timesCompleted: 3 + (index % 6),
  bestAccuracy: Number((78 + (index % 5) * 4.5).toFixed(2)),
}));

async function upsertUsers(client, passwordHash) {
  for (const user of users) {
    const stripeAccountId = user.seller ? `acct_handoff_${user.id.slice(-6)}` : null;
    await client.query(
      `INSERT INTO users (
        id, email, password_hash, plan, created_at, trial_ends_at, study_score, email_verified, role,
        display_name, seller_terms_accepted_at, seller_terms_version, stripe_connect_account_id,
        connect_charges_enabled, connect_payouts_enabled, preferences
      )
      VALUES (
        $1, $2, $3, $4, NOW() - INTERVAL '14 days', CASE WHEN $4 = 'trial' THEN NOW() + INTERVAL '5 days' ELSE NULL END,
        $5, true, $6, $7, CASE WHEN $8 THEN NOW() - INTERVAL '7 days' ELSE NULL END, CASE WHEN $8 THEN 1 ELSE NULL END,
        $9, $8, $8, '{"analytics_opt_out": true}'::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        plan = EXCLUDED.plan,
        study_score = EXCLUDED.study_score,
        email_verified = EXCLUDED.email_verified,
        role = EXCLUDED.role,
        display_name = EXCLUDED.display_name,
        seller_terms_accepted_at = EXCLUDED.seller_terms_accepted_at,
        seller_terms_version = EXCLUDED.seller_terms_version,
        stripe_connect_account_id = EXCLUDED.stripe_connect_account_id,
        connect_charges_enabled = EXCLUDED.connect_charges_enabled,
        connect_payouts_enabled = EXCLUDED.connect_payouts_enabled,
        preferences = EXCLUDED.preferences`,
      [
        user.id,
        user.email,
        passwordHash,
        user.plan,
        user.studyScore,
        user.role,
        user.displayName,
        user.seller,
        stripeAccountId,
      ]
    );
  }
}

async function upsertCategories(client) {
  for (const category of categories) {
    await client.query(
      `INSERT INTO marketplace_categories (id, name, slug, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         slug = EXCLUDED.slug,
         sort_order = EXCLUDED.sort_order`,
      [category.id, category.name, category.slug, category.sortOrder]
    );
  }
}

async function upsertDecksAndListings(client) {
  for (const deck of decks) {
    const owner = users.find((user) => user.email === deck.ownerEmail);
    const category = categories.find((entry) => entry.slug === deck.categorySlug);

    await client.query(
      `INSERT INTO decks (id, user_id, title, source_text, origin, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'generated', NOW() - INTERVAL '10 days', NOW() - INTERVAL '2 days')
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         title = EXCLUDED.title,
         source_text = EXCLUDED.source_text,
         origin = EXCLUDED.origin,
         updated_at = EXCLUDED.updated_at`,
      [deck.id, owner.id, deck.title, deck.sourceText]
    );

    await client.query('DELETE FROM cards WHERE deck_id = $1', [deck.id]);
    for (const card of buildCards(deck)) {
      await client.query(
        `INSERT INTO cards (id, deck_id, front, back, position, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '9 days')`,
        [card.id, deck.id, card.front, card.back, card.position]
      );
    }

    await client.query(
      `INSERT INTO marketplace_listings (
        id, deck_id, seller_id, category_id, title, description, price_cents, status,
        moderation_status, moderation_reason, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'active', 'approved', 'seed approved',
        NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day'
      )
      ON CONFLICT (id) DO UPDATE SET
        deck_id = EXCLUDED.deck_id,
        seller_id = EXCLUDED.seller_id,
        category_id = EXCLUDED.category_id,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        price_cents = EXCLUDED.price_cents,
        status = EXCLUDED.status,
        moderation_status = EXCLUDED.moderation_status,
        moderation_reason = EXCLUDED.moderation_reason,
        updated_at = EXCLUDED.updated_at`,
      [deck.listingId, deck.id, owner.id, category.id, deck.title, deck.description, deck.priceCents]
    );

    await client.query('DELETE FROM listing_tags WHERE listing_id = $1', [deck.listingId]);
    for (const tag of deck.tags) {
      await client.query(
        `INSERT INTO listing_tags (id, listing_id, tag)
         VALUES ($1, $2, $3)
         ON CONFLICT (listing_id, tag) DO NOTHING`,
        [seededUuid(90 + decks.findIndex((candidate) => candidate.id === deck.id), deck.tags.indexOf(tag) + 1), deck.listingId, tag]
      );
    }
  }
}

async function upsertRatings(client) {
  for (const rating of ratings) {
    await client.query(
      `INSERT INTO ratings (id, user_id, listing_id, stars, review_text, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '6 days', NOW() - INTERVAL '1 day')
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         listing_id = EXCLUDED.listing_id,
         stars = EXCLUDED.stars,
         review_text = EXCLUDED.review_text,
         updated_at = EXCLUDED.updated_at`,
      [rating.id, rating.userId, rating.listingId, rating.stars, rating.reviewText]
    );
  }

  await client.query(
    `UPDATE marketplace_listings ml
     SET average_rating = COALESCE(summary.avg_rating, 0),
         rating_count = COALESCE(summary.rating_count, 0)
     FROM (
       SELECT listing_id, ROUND(AVG(stars)::numeric, 2) AS avg_rating, COUNT(*)::int AS rating_count
       FROM ratings
       WHERE listing_id = ANY($1::uuid[])
       GROUP BY listing_id
     ) summary
     WHERE ml.id = summary.listing_id`,
    [decks.map((deck) => deck.listingId)]
  );
}

async function upsertFlags(client) {
  for (const flag of contentFlags) {
    await client.query(
      `INSERT INTO content_flags (
        id, listing_id, reporter_id, reason, status, admin_notes, flag_type, rating_id, created_at, resolved_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NOW() - INTERVAL '2 days',
        CASE WHEN $5 = 'pending' THEN NULL ELSE NOW() - INTERVAL '1 day' END
      )
      ON CONFLICT (id) DO UPDATE SET
        listing_id = EXCLUDED.listing_id,
        reporter_id = EXCLUDED.reporter_id,
        reason = EXCLUDED.reason,
        status = EXCLUDED.status,
        admin_notes = EXCLUDED.admin_notes,
        flag_type = EXCLUDED.flag_type,
        rating_id = EXCLUDED.rating_id,
        resolved_at = EXCLUDED.resolved_at`,
      [
        flag.id,
        flag.listingId,
        flag.reporterId,
        flag.reason,
        flag.status,
        flag.adminNotes,
        flag.flagType,
        flag.ratingId,
      ]
    );
  }
}

async function upsertDeckStats(client) {
  for (const stat of deckStats) {
    await client.query(
      `INSERT INTO deck_stats (id, user_id, deck_id, times_completed, best_accuracy, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day')
       ON CONFLICT (user_id, deck_id) DO UPDATE SET
         times_completed = EXCLUDED.times_completed,
         best_accuracy = EXCLUDED.best_accuracy,
         updated_at = EXCLUDED.updated_at`,
      [stat.id, stat.userId, stat.deckId, stat.timesCompleted, stat.bestAccuracy]
    );
  }
}

async function seed() {
  const pool = new pg.Pool(getMigrationConfig());

  try {
    const passwordHash = await bcrypt.hash('password123', 10);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await upsertUsers(client, passwordHash);
      await upsertCategories(client);
      await upsertDecksAndListings(client);
      await upsertRatings(client);
      await upsertFlags(client);
      await upsertDeckStats(client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    console.log('Handoff seed completed.');
    console.log('Users:', users.length);
    console.log('Categories:', categories.length);
    console.log('Decks:', decks.length);
    console.log('Ratings:', ratings.length);
    console.log('Flags:', contentFlags.length);
    console.log('Seed login: maya.chen@example.com / password123');
  } catch (error) {
    console.error('Handoff seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
