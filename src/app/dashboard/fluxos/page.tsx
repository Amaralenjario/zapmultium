export default function FluxosPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Fluxos</h1>
        <p className="text-gray-400 text-sm">Crie e gerencie fluxos de atendimento automatizado</p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-8">
        <div className="flex items-center justify-center h-64 text-gray-500 border border-dashed border-gray-700 rounded-lg">
          <div className="text-center">
            <p className="text-lg">Nenhum fluxo criado</p>
            <p className="text-sm mt-1">Crie seu primeiro fluxo de atendimento</p>
          </div>
        </div>
      </div>
    </div>
  );
}
