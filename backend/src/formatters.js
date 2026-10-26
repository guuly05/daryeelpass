export function formatAppointment(appointment) {
  return {
    id: appointment.id,
    status: appointment.status.toLowerCase(),
    startsAt: appointment.slot.startsAt.toISOString(),
    durationMinutes: appointment.slot.service.durationMinutes,
    service: {
      id: appointment.slot.service.id,
      slug: appointment.slot.service.slug,
      nameKey: appointment.slot.service.nameKey
    },
    clinic: {
      id: appointment.slot.service.clinic.id,
      slug: appointment.slot.service.clinic.slug,
      nameKey: appointment.slot.service.clinic.nameKey,
      locationKey: appointment.slot.service.clinic.locationKey,
      timezone: appointment.slot.service.clinic.timezone
    }
  };
}

export const appointmentDetails = {
  slot: {
    include: {
      service: {
        include: { clinic: true }
      }
    }
  }
};
