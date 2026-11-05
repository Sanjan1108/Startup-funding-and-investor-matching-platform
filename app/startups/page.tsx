import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import DataPage from '@/components/DataPage';

export default async function Page() {
  const u = await currentUser();

  if (!u) redirect('/login');

  return (
    <DataPage
      userName={u.name}
      title="Startup directory"
      subtitle="Profiles, sectors and funding stages."
      type="startups"
      fields={[
        {
          name: 'startup_name',
          label: 'Startup name',
          required: true,
        },
        {
          name: 'industry_id',
          label: 'Industry',
          required: true,
          options: [
            { value: '1', label: 'FinTech' },
            { value: '2', label: 'HealthTech' },
            { value: '3', label: 'EdTech' },
            { value: '4', label: 'AgriTech' },
            { value: '5', label: 'E-Commerce' },
            { value: '6', label: 'Artificial Intelligence' },
            { value: '7', label: 'CleanTech' },
            { value: '8', label: 'Cybersecurity' },
          ],
        },
        {
          name: 'funding_stage',
          label: 'Funding stage',
          required: true,
          options: [
            { value: 'PRE_SEED', label: 'Pre-Seed' },
            { value: 'SEED', label: 'Seed' },
            { value: 'SERIES_A', label: 'Series A' },
            { value: 'SERIES_B', label: 'Series B' },
            { value: 'SERIES_C', label: 'Series C' },
          ],
        },
        {
          name: 'location',
          label: 'Location',
        },
        {
          name: 'website',
          label: 'Website',
          type: 'url',
        },
        {
          name: 'description',
          label: 'Description',
        },
      ]}
      columns={[
        { key: 'startup_name', label: 'Startup' },
        { key: 'industry_name', label: 'Industry' },
        { key: 'funding_stage', label: 'Funding stage' },
        { key: 'location', label: 'Location' },
        { key: 'website', label: 'Website' },
      ]}
    />
  );
}
