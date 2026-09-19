import { useCallback, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import BootScreen from "./components/BootScreen.jsx";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Questionnaire from "./pages/Questionnaire.jsx";
import Results from "./pages/Results.jsx";
import Repository from "./pages/Repository.jsx";
import ScamDetail from "./pages/ScamDetail.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  const navigate = useNavigate();
  const [booting, setBooting] = useState(true);
  const finishBoot = useCallback(() => {
    window.scrollTo(0, 0);
    navigate("/", { replace: true });
    setBooting(false);
  }, [navigate]);

  return (
    <>
      {booting ? <BootScreen onDone={finishBoot} /> : null}
      <div className={booting ? "app-shell" : "app-shell is-ready"}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="questionnaire" element={<Questionnaire />} />
            <Route path="results" element={<Results />} />
            <Route path="scams" element={<Repository />} />
            <Route path="scams/:id" element={<ScamDetail />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </div>
    </>
  );
}
