const axios = require('axios');

module.exports = async (req, res) => {
  const { start_date, end_date } = req.query;

  try {
    // Fazer login na API OceanTrack
    const loginPayload = {
      login: "intmessenocean",
      password: "BvnaxLhr99!#!"
    };
    const loginResponse = await axios.post('https://ws.oceantrack.com.br/User/login', loginPayload);
    const token = loginResponse.data.token;

    // Requisição do tipo34
    const payload = {
      mobile: ["01916481SKYA982"],
      start_date,
      end_date
    };
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    const response = await axios.post('https://ws.oceantrack.com.br/IntegrationServer/Tipo34', payload, { headers });

    // Processar os dados
    const processedData = processData(response.data);
    res.status(200).json(processedData);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar a requisição' });
  }
};

function parseDataField(dataStr) {
  if (!dataStr || dataStr.includes('NAN') || dataStr.includes('inicio[NAN]')) {
    return { type: null, date: null, time: null, status: 'NO_DATA' };
  }

  let type = null;
  if (dataStr.includes('?MNM')) type = 'MNM';
  else if (dataStr.includes('?MNN')) type = 'MNN';

  const parts = dataStr.split(',');
  if (parts.length >= 3) {
    const datePart = parts[1]; // AAAAMMDD
    const timePart = parts[2]; // HHMMSS
    try {
      const date = new Date(datePart.substring(0,4), datePart.substring(4,6)-1, datePart.substring(6,8));
      const time = new Date(1970, 0, 1, timePart.substring(0,2), timePart.substring(2,4), timePart.substring(4,6));
      return { type, date, time, status: 'OK' };
    } catch (e) {
      return { type, date: null, time: null, status: 'PARSE_ERROR' };
    }
  }
  return { type, date: null, time: null, status: 'INCOMPLETE_DATA' };
}

function processData(responseData) {
  const records = [];
  const dataByType = { MNN: [], MNM: [], 'N/A': [] };

  // Parsear e organizar os dados
  responseData.forEach(entry => {
    const dhRegistro = new Date(entry.dh_registro.replace('Z', ''));
    const dhRegistroBr = new Date(dhRegistro.getTime() - 3*60*60*1000); // Ajuste para UTC-3
    const { type, date, time, status } = parseDataField(entry.data);

    if (status !== 'OK') {
      records.push({
        type: type || 'N/A',
        date: 'N/A',
        time: 'N/A',
        dhRegistro: dhRegistroBr.toISOString(),
        status
      });
      dataByType[type || 'N/A'].push({ time: dhRegistroBr, status });
    } else {
      const dataDateTime = new Date(date);
      dataDateTime.setHours(time.getHours(), time.getMinutes(), time.getSeconds());
      records.push({
        type,
        date: date.toISOString().split('T')[0],
        time: time.toTimeString().split(' ')[0],
        dhRegistro: dhRegistroBr.toISOString(),
        status
      });
      dataByType[type].push({ time: dataDateTime, status });
    }
  });

  // Detectar dados faltantes (lacunas > 30 minutos)
  for (const type in dataByType) {
    if (type === 'N/A') continue;
    const entries = dataByType[type].filter(e => e.status === 'OK').sort((a, b) => a.time - b.time);
    for (let i = 0; i < entries.length - 1; i++) {
      const currentTime = entries[i].time;
      const nextTime = entries[i+1].time;
      const timeDiff = (nextTime - currentTime) / 60000;
      if (timeDiff > 35) {
        let expectedTime = new Date(currentTime.getTime() + 30*60000);
        while (expectedTime < nextTime) {
          records.push({
            type,
            date: expectedTime.toISOString().split('T')[0],
            time: expectedTime.toTimeString().split(' ')[0],
            dhRegistro: null,
            status: 'MISSING'
          });
          expectedTime = new Date(expectedTime.getTime() + 30*60000);
        }
      }
    }
  }

  // Agrupar por dia e calcular estatísticas
  const dailyStats = {};
  records.forEach(record => {
    const date = record.date;
    if (!dailyStats[date]) {
      dailyStats[date] = { total: 0, ok: 0, missing: 0 };
    }
    dailyStats[date].total += 1;
    if (record.status === 'OK') dailyStats[date].ok += 1;
    else dailyStats[date].missing += 1;
  });

  const result = {};
  for (const date in dailyStats) {
    const stats = dailyStats[date];
    const lossPercentage = (stats.missing / stats.total) * 100;
    result[date] = {
      total: stats.total,
      ok: stats.ok,
      missing: stats.missing,
      lossPercentage: lossPercentage.toFixed(2),
      records: records.filter(r => r.date === date)
    };
  }

  return result;
}