import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [data, setData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch('/api/get-data');
      const json = await response.json();
      setData(json);
    };
    fetchData();
    const interval = setInterval(fetchData, 60000); // Atualiza a cada 60 segundos
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="App">
      <h1>Logs OceanTrack</h1>
      {data && <DataTable data={data} onSelectDate={setSelectedDate} />}
      {selectedDate && data.find(d => d.date === selectedDate) && (
        <DetailTable records={data.find(d => d.date === selectedDate).records} />
      )}
    </div>
  );
}

function DataTable({ data, onSelectDate }) {
  return (
    <div>
      <h2>Resumo por Dia</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Total</th>
            <th>OK</th>
            <th>Faltantes</th>
            <th>% Perda</th>
            <th>Atraso Médio (min)</th>
            <th>Atraso Máx (min)</th>
            <th>Atraso Mín (min)</th>
          </tr>
        </thead>
        <tbody>
          {data.map(day => (
            <tr key={day.date} onClick={() => onSelectDate(day.date)} style={{ cursor: 'pointer' }}>
              <td>{day.date}</td>
              <td>{day.total}</td>
              <td>{day.ok}</td>
              <td>{day.missing}</td>
              <td>{day.lossPercentage}%</td>
              <td>{day.avgDelay}</td>
              <td>{day.maxDelay}</td>
              <td>{day.minDelay}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailTable({ records }) {
  return (
    <div>
      <h3>Detalhes dos Registros</h3>
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Horário do Dado</th>
            <th>Hora de Chegada</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={index}>
              <td>{record.type || 'N/A'}</td>
              <td>{record.data_time ? new Date(record.data_time).toLocaleString() : 'N/A'}</td>
              <td>{record.arrival_time ? new Date(record.arrival_time).toLocaleString() : 'N/A'}</td>
              <td>{record.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;