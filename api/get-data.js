const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://eaoqiiobjlqhqcryqzwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhb3FpaW9iamxxaHFjcnlxendqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxODY0OTYsImV4cCI6MjA1ODc2MjQ5Nn0.saH1Ghv9m8gaQy5IV5uJ0tI9dsmMSpqE0JegIxzZvHA';
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  try {
    const { data: dailyStats } = await supabase.from('daily_stats').select('*').order('date', { ascending: true });
    const { data: records } = await supabase.from('records').select('*').order('date', { ascending: true }).order('data_time', { ascending: true });

    const groupedRecords = {};
    records.forEach(record => {
      if (!groupedRecords[record.date]) groupedRecords[record.date] = [];
      groupedRecords[record.date].push(record);
    });

    const result = dailyStats.map(stat => ({
      date: stat.date,
      total: stat.total_records,
      ok: stat.ok_records,
      missing: stat.missing_records,
      lossPercentage: stat.loss_percentage,
      avgDelay: stat.avg_delay,
      maxDelay: stat.max_delay,
      minDelay: stat.min_delay,
      records: groupedRecords[stat.date] || []
    }));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
};