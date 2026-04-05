# Importar todos los modelos para que SQLAlchemy los registre
from models.usuario import Usuario, TutorAula
from models.estudiante import Estudiante, ApoderadoEstudiante
from models.asistencia import Asistencia, Horario
from models.comunicado import Comunicado, ComunicadoDestinatario, ComunicadoRespuesta, ObservacionTutor
from models.justificacion import Justificacion
from models.dia_no_laborable import DiasNoLaborables, ReporteSemanal
from models.horario_curso import HorarioCurso
from models.horario_archivo import HorarioArchivo
