import { Cpu } from 'lucide-react';

export default function ElectricalSchematic() {
  return (
    <div className="glass-panel" style={{ position: 'absolute', top: '1rem', right: '1rem', width: '300px', padding: '1rem', zIndex: 10 }}>
      <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Cpu size={20} /> Schematic & Data
      </h2>
      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem', fontSize: '0.85rem', color: '#ccc' }}>
        <p style={{ margin: '0 0 0.5rem 0' }}><strong>Microcontroller:</strong> ESP32</p>
        <p style={{ margin: '0 0 0.5rem 0' }}><strong>Servo Driver:</strong> PCA9685 (I2C)</p>
        <p style={{ margin: '0 0 0.5rem 0' }}><strong>Power:</strong> 5V 10A DC (Motors), 3.3V (Logic)</p>
        <p style={{ margin: 0 }}><strong>Link:</strong> <a href="#" style={{ color: '#4da6ff' }}>View Wokwi Schematic</a></p>
      </div>
      
      <div style={{ marginTop: '1rem', height: '150px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#666' }}>
         (Schematic Diagram Placeholder)
      </div>
    </div>
  );
}
