const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabaseUrl = 'https://eaoqiiobjlqhqcryqzwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhb3FpaW9iamxxaHFjcnlxendqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxODY0OTYsImV4cCI6MjA1ODc2MjQ5Nn0.saH1Ghv9m8gaQy5IV5uJ0tI9dsmMSpqE0JegIxzZvHA';
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2023-01-31');
    const intervalDays = 2; // Blocos de 2 dias
  
    try {
      // Login na API OceanTrack
        const loginResponse = await axios.post('https://ws.oceantrack.com.br/User/login', {
            login: 'intmessenocean',
            password: 'BvnaxLhr99!#!'
        });
        const token = loginResponse.data.token;
  
        let currentStart = startDate;
        while (currentStart < endDate) {
            const currentEnd = new Date(currentStart);
            currentEnd.setDate(currentEnd.getDate() + intervalDays - 1);
            if (currentEnd > endDate) currentEnd.setDate(endDate.getDate());
    
            const startStr = currentStart.toISOString().split('T')[0] + 'T00:00:00.000';
            const endStr = currentEnd.toISOString().split('T')[0] + 'T23:59:59.999';
    
            // Buscar dados da API OceanTrack para o intervalo
            const payload = {
                mobile: ['01916481SKYA982'],
                start_date: startStr,
                end_date: endStr
            };
            const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
            const response = await axios.post('https://ws.oceantrack.com.br/IntegrationServer/Tipo34', payload, { headers });
    
            // Processar os dados (assumindo que processData já existe)
            const processedData = processData(response.data);
    
            // Armazenar no Supabase
            for (const date in processedData) {
                const stats = processedData[date];
                await supabase.from('daily_stats').upsert({
                    date,
                    total_records: stats.total,
                    ok_records: stats.ok,
                    missing_records: stats.missing,
                    loss_percentage: stats.lossPercentage,
                    avg_delay: stats.avgDelay,
                    max_delay: stats.maxDelay,
                    min_delay: stats.minDelay,
                    last_updated: new Date().toISOString()
                });
        
                for (const record of stats.records) {
                    await supabase.from('records').insert({
                    date,
                    type: record.type,
                    data_time: record.dataTime,
                    arrival_time: record.arrivalTime,
                    status: record.status
                    });
                }
            }
    
            // Avançar para o próximo bloco
            currentStart.setDate(currentStart.getDate() + intervalDays);
        }
    
        res.status(200).json({ message: 'Dados de janeiro armazenados com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar os dados' });
    }
};

// Funções auxiliares para processar os dados
function parseDataField(dataStr) {
  if (!dataStr || dataStr.includes('NAN')) return { type: null, date: null, time: null, status: 'NO_DATA' };
  const type = dataStr.includes('?MNM') ? 'MNM' : dataStr.includes('?MNN') ? 'MNN' : null;
  const parts = dataStr.split(',');
  if (parts.length >= 3) {
    const datePart = parts[1]; // AAAAMMDD
    const timePart = parts[2]; // HHMMSS
    const date = `${datePart.slice(0,4)}-${datePart.slice(4,6)}-${datePart.slice(6,8)}`;
    const time = `${timePart.slice(0,2)}:${timePart.slice(2,4)}:${timePart.slice(4,6)}`;
    return { type, date, time, status: 'OK' };
  }
  return { type, date: null, time: null, status: 'INCOMPLETE_DATA' };
}

function processData(responseData) {
  const records = [];
  const dataByType = { MNN: [], MNM: [], 'N/A': [] };

  // Parsear os dados
  responseData.forEach(entry => {
    const arrivalTime = new Date(entry.dh_registro.replace('Z', '') + '-03:00'); // UTC-3
    const { type, date, time, status } = parseDataField(entry.data);

    if (status !== 'OK') {
      records.push({ type: type || 'N/A', date: date || 'N/A', dataTime: null, arrivalTime: arrivalTime.toISOString(), status });
      dataByType[type || 'N/A'].push({ time: arrivalTime, status });
    } else {
      const dataTime = new Date(`${date}T${time}-03:00`);
      records.push({ type, date, dataTime: dataTime.toISOString(), arrivalTime: arrivalTime.toISOString(), status });
      dataByType[type].push({ time: dataTime, status });
    }
  });

  // Inserir dados faltantes (lacunas > 30 minutos)
  for (const type in dataByType) {
    if (type === 'N/A') continue;
    const entries = dataByType[type].filter(e => e.status === 'OK').sort((a, b) => a.time - b.time);
    for (let i = 0; i < entries.length - 1; i++) {
      const currentTime = entries[i].time;
      const nextTime = entries[i + 1].time;
      const timeDiff = (nextTime - currentTime) / 60000;
      if (timeDiff > 35) {
        let expectedTime = new Date(currentTime.getTime() + 30 * 60000);
        while (expectedTime < nextTime) {
          records.push({
            type,
            date: expectedTime.toISOString().split('T')[0],
            dataTime: expectedTime.toISOString(),
            arrivalTime: null,
            status: 'MISSING'
          });
          expectedTime = new Date(expectedTime.getTime() + 30 * 60000);
        }
      }
    }
  }

  // Agrupar por dia e calcular estatísticas
  const dailyStats = {};
  records.forEach(record => {
    const date = record.date;
    if (!dailyStats[date]) dailyStats[date] = { total: 0, ok: 0, missing: 0, delays: [] };
    dailyStats[date].total += 1;
    if (record.status === 'OK') {
      dailyStats[date].ok += 1;
      if (record.arrivalTime && record.dataTime) {
        dailyStats[date].delays.push((new Date(record.arrivalTime) - new Date(record.dataTime)) / 60000);
      }
    } else {
      dailyStats[date].missing += 1;
    }
  });

  const result = {};
  for (const date in dailyStats) {
    const stats = dailyStats[date];
    const delays = stats.delays;
    result[date] = {
      total: stats.total,
      ok: stats.ok,
      missing: stats.missing,
      lossPercentage: ((stats.missing / stats.total) * 100).toFixed(2),
      avgDelay: delays.length ? (delays.reduce((a, b) => a + b, 0) / delays.length).toFixed(2) : 'N/A',
      maxDelay: delays.length ? Math.max(...delays).toFixed(2) : 'N/A',
      minDelay: delays.length ? Math.min(...delays).toFixed(2) : 'N/A',
      records: records.filter(r => r.date === date).sort((a, b) => new Date(a.dataTime || a.arrivalTime) - new Date(b.dataTime || b.arrivalTime))
    };
  }
  return result;
}