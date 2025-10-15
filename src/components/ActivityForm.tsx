import React, { useState } from 'react';
import { backgroundSyncService } from '../services/backgroundSyncService';
import { syncService } from '../services/syncService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface ActivityFormProps {
  onActivityAdded?: () => void;
}

const ActivityForm: React.FC<ActivityFormProps> = ({ onActivityAdded }) => {
  const [formData, setFormData] = useState({
    studentName: '',
    subject: '',
    activity: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    status: 'pendiente' as const
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const { isOnline } = useNetworkStatus();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      // Validar campos requeridos
      if (!formData.studentName || !formData.subject || !formData.activity) {
        setSubmitMessage({
          type: 'error',
          text: 'Por favor completa todos los campos requeridos'
        });
        return;
      }

      // Usar el syncService existente que maneja todo automáticamente
      console.log('💾 Guardando actividad con syncService...');
      
      // El syncService maneja automáticamente IndexedDB + Firestore + Background Sync
      const savedActivity = await syncService.createActivity(formData);
      
      if (isOnline) {
        setSubmitMessage({
          type: 'success',
          text: '✅ Actividad guardada y sincronizada con Firestore'
        });
      } else {
        // También registrar en Background Sync como respaldo (sin bloquear)
        try {
          await backgroundSyncService.syncNewActivity(savedActivity);
        } catch (syncError) {
          console.warn('⚠️ Error en background sync (no crítico):', syncError);
        }
        
        setSubmitMessage({
          type: 'info',
          text: '📱 Sin conexión: Actividad guardada localmente y se sincronizará automáticamente cuando haya conexión'
        });
      }

      // Limpiar formulario
      setFormData({
        studentName: '',
        subject: '',
        activity: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        status: 'pendiente'
      });

      // Notificar al componente padre
      onActivityAdded?.();

    } catch (error) {
      console.error('Error al enviar formulario:', error);
      setSubmitMessage({
        type: 'error',
        text: '❌ Error al guardar la actividad. Inténtalo de nuevo.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="activity-form-container">
      <div className="form-header">
        <h3>📝 Nueva Actividad</h3>
        <div className="connection-status">
          {isOnline ? (
            <span className="status-online">🌐 Conectado</span>
          ) : (
            <span className="status-offline">📱 Sin conexión</span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="activity-form">
        <div className="form-group">
          <label htmlFor="studentName">
            Nombre del Estudiante *
          </label>
          <input
            type="text"
            id="studentName"
            name="studentName"
            value={formData.studentName}
            onChange={handleInputChange}
            placeholder="Ingresa el nombre del estudiante"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="subject">
            Materia *
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleInputChange}
            placeholder="Ej: Matemáticas, Historia, etc."
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="activity">
            Actividad *
          </label>
          <input
            type="text"
            id="activity"
            name="activity"
            value={formData.activity}
            onChange={handleInputChange}
            placeholder="Describe la actividad"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">
            Descripción
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Detalles adicionales (opcional)"
            rows={3}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="date">
              Fecha
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">
              Estado
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              disabled={isSubmitting}
            >
              <option value="pendiente">Pendiente</option>
              <option value="en-progreso">En Progreso</option>
              <option value="completada">Completada</option>
            </select>
          </div>
        </div>

        {submitMessage && (
          <div className={`submit-message ${submitMessage.type}`}>
            {submitMessage.text}
          </div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            disabled={isSubmitting}
            className="submit-button"
          >
            {isSubmitting ? (
              <>
                <span className="loading-spinner"></span>
                Guardando...
              </>
            ) : (
              <>
                💾 Guardar Actividad
              </>
            )}
          </button>
        </div>

        <div className="sync-info">
          {isOnline ? (
            <p className="sync-status online">
              🔄 Las actividades se sincronizarán automáticamente con el servidor
            </p>
          ) : (
            <p className="sync-status offline">
              📱 Sin conexión: Las actividades se guardarán localmente y se sincronizarán cuando haya conexión
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default ActivityForm;
