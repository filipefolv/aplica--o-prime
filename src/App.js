import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './App.css';


function App() {
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [data, setData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const fetchData = async () => {
    const start = startDate.toISOString().split('T')[0] + 'T00:00:00.000';
    const end = endDate.toISOString().split('T')[0] + 'T23:59:59.999';
    try {
      const response = await fetch(`/api/tipo34?start_date=${start}&end_date=${end}`);
      const json = await response.json();
      setData(json);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    }
  };

  return (
    <div className="App">
      <h1>Logs OceanTrack</h1>
      <div>
        <label>Data Inicial: </label>
        <DatePicker selected={startDate} onChange={date => setStartDate(date)} />
        <label>Data Final: </label>
        <DatePicker selected={endDate} onChange={date => setEndDate(date)} />
        <button onClick={fetchData}>Obter Dados</button>
      </div>
      {data && (
        <DataTable data={data} onSelectDate={setSelectedDate} />
      )}
      {selectedDate && data[selectedDate] && (
        <DetailTable records={data[selectedDate].records} />
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
            <th>Total Registros</th>
            <th>OK</th>
            <th>Faltantes</th>
            <th>% Perda</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data).map(([date, stats]) => (
            <tr key={date} onClick={() => onSelectDate(date)} style={{ cursor: 'pointer' }}>
              <td>{date}</td>
              <td>{stats.total}</td>
              <td>{stats.ok}</td>
              <td>{stats.missing}</td>
              <td>{stats.lossPercentage}%</td>
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
              <td>{record.time}</td>
              <td>{record.dhRegistro ? new Date(record.dhRegistro).toLocaleString() : 'N/A'}</td>
              <td>{record.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;