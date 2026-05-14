import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function simulateTelemetry(userId: string, count: number) {
  console.log(`Simulating ${count} telemetry events for ${userId}...`);
  const events = Array.from({ length: count }).map((_, i) => ({
    user_id: userId,
    event_type: i % 10 === 0 ? 'critical_error' : 'page_view',
    payload: { path: '/dashboard', index: i },
    client_timestamp: new Date().toISOString()
  }));
  
  const { error } = await supabase.from('telemetry_events').insert(events);
  if (error) console.error('Telemetry simulation failed:', error);
  else console.log('Telemetry simulation successful.');
}

async function simulateFsrsReview(userId: string) {
  console.log(`Simulating FSRS review for ${userId}...`);
  // Get a card
  const { data: cards } = await supabase.from('fsrs_cards').select('id').eq('user_id', userId).limit(1);
  if (!cards || cards.length === 0) {
    console.log('No cards found for user, creating one...');
    const { data: newCard } = await supabase.from('fsrs_cards').insert({
      user_id: userId,
      card_type: 'topic',
      card_ref_id: 'cardiologia',
      stability: 1,
      difficulty: 5,
      reps: 0,
      lapses: 0,
      state: 0,
      due: new Date().toISOString()
    }).select().single();
    if (newCard) {
      // Log review
      await supabase.from('fsrs_review_log').insert({
        user_id: userId,
        card_id: newCard.id,
        rating: 3,
        scheduled_days: 4,
        elapsed_days: 0,
        reviewed_at: new Date().toISOString()
      });
      console.log('FSRS review simulated.');
    }
  } else {
    await supabase.from('fsrs_review_log').insert({
      user_id: userId,
      card_id: cards[0].id,
      rating: 3,
      scheduled_days: 4,
      elapsed_days: 0,
      reviewed_at: new Date().toISOString()
    });
    console.log('FSRS review simulated for existing card.');
  }
}

async function main() {
  const { data: users } = await supabase.from('profiles').select('id').limit(5);
  if (!users || users.length === 0) {
    console.log('No users found to simulate.');
    return;
  }

  for (const user of users) {
    await simulateTelemetry(user.id, 50);
    await simulateFsrsReview(user.id);
  }
}

main().catch(console.error);
