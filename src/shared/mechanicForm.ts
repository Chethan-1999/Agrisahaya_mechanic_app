import type { Mechanic, MechanicForm } from '../types';

export function trimMechanicForm(form: MechanicForm): MechanicForm {
  return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as MechanicForm;
}

export function toMechanicForm(mechanic: Mechanic): MechanicForm {
  return {
    fullName: mechanic.fullName,
    phoneNumber: mechanic.phoneNumber,
    village: mechanic.village,
    district: mechanic.district,
    state: mechanic.state,
    pincode: mechanic.pincode,
    address: mechanic.address,
    landmark: mechanic.landmark,
    age: mechanic.age,
    experience: mechanic.experience,
  };
}
